#!/usr/bin/env bash
# Installs the Botsman server for the current user: checks out the code, checks Node and pnpm, sets up bubblewrap and
# its AppArmor profile, installs dependencies, and starts a systemd user service. Installing bubblewrap and the profile
# needs root, and so does lingering when logind refuses it.
#
#   deploy/install.sh                     Installs the newest server release, the newest server-v* tag, or updates to it.
#   deploy/install.sh --preview <branch>  Installs a preview server running <branch>, next to the real one.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_DIR="$HOME/botsman-preview"
PNPM_VERSION="12.18.0"
NODE_MAJOR="24"
PNPM="pnpm"
MODE="release"
BRANCH=""

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nerror: %s\n' "$*" >&2; exit 1; }

parse_args() {
  case "${1:-}" in
    "") ;;
    --preview)
      [ -n "${2:-}" ] || fail "Name the branch: deploy/install.sh --preview <branch>"
      MODE="preview"
      BRANCH="$2"
      ;;
    *) fail "Unknown option $1. Usage: deploy/install.sh [--preview <branch>]" ;;
  esac
}

# The real server and a preview server each have their own checkout, service, port, and data, so neither touches
# the other.
configure() {
  if [ "$MODE" = "preview" ]; then
    TARGET="$PREVIEW_DIR" SERVICE="botsman-preview" DESCRIPTION="Botsman preview server" PORT="7601" PREVIEW="1"
    DATA_DIR="$HOME/.botsman-preview" BACKUP_DIR="$HOME/.botsman-preview-backups"
  else
    TARGET="$REPO" SERVICE="botsman" DESCRIPTION="Botsman server" PORT="7600" PREVIEW="0"
    DATA_DIR="$HOME/.botsman" BACKUP_DIR="$HOME/.botsman-backups"
  fi
}

# The newest server-v<major>.<minor>.<patch> tag on origin. Reading the remote, not the local tags, means a tag deleted
# or moved on origin never comes back from an earlier fetch, and a tag never pushed is never installed.
newest_release_tag() {
  local refs
  refs="$(git -C "$REPO" ls-remote --tags --refs origin 'server-v*')" || fail "Couldn't list the releases on origin."
  printf '%s\n' "$refs" | sed -nE 's#.*refs/tags/(server-v[0-9]+\.[0-9]+\.[0-9]+)$#\1#p' | sort -V | awk 'END { print }'
}

# Checks out the newest server release, then hands over to that release's own copy of this script.
checkout_release() {
  if [ "${BOTSMAN_RELEASE_CHECKED_OUT:-}" = "1" ]; then return; fi
  say "Checking out the newest server release"
  local tag
  tag="$(newest_release_tag)"
  [ -n "$tag" ] || fail "There is no server release yet: origin has no server-v* tag."
  git -C "$REPO" fetch --quiet --force origin "refs/tags/$tag:refs/tags/$tag"
  git -C "$REPO" checkout --quiet --detach "$tag" || fail "Couldn't check out $tag. Commit or discard the changes in $REPO, then run this again."
  BOTSMAN_RELEASE_CHECKED_OUT=1 exec "$REPO/deploy/install.sh"
}

# Checks out the branch under test in a second checkout of the same remote, made on first use. Changes made by hand
# in that checkout are discarded.
checkout_preview() {
  local origin
  origin="$(git -C "$REPO" remote get-url origin)"
  if [ ! -d "$PREVIEW_DIR/.git" ]; then
    say "Making a second checkout for the preview server in $PREVIEW_DIR"
    git clone --quiet "$origin" "$PREVIEW_DIR"
  fi
  say "Checking out $BRANCH"
  git -C "$PREVIEW_DIR" fetch --quiet origin "$BRANCH" || fail "There is no branch $BRANCH on $origin."
  git -C "$PREVIEW_DIR" checkout --quiet --force --detach FETCH_HEAD
}

# Node 24 runs the server directly from its TypeScript sources.
check_node() {
  command -v node >/dev/null || fail "Node ${NODE_MAJOR} is required. Install it, then run this again."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" = "$NODE_MAJOR" ] || fail "Node ${NODE_MAJOR} is required; found $(node -v)."
}

# Installs pnpm under ~/.local, so it works when Node itself is installed system-wide and owned by root.
check_pnpm() {
  if command -v pnpm >/dev/null && [ "$(pnpm -v)" = "$PNPM_VERSION" ]; then return; fi
  PNPM="$HOME/.local/bin/pnpm"
  if [ -x "$PNPM" ] && [ "$("$PNPM" -v)" = "$PNPM_VERSION" ]; then return; fi
  say "Installing pnpm ${PNPM_VERSION} for this user"
  npm install --global --prefix "$HOME/.local" "pnpm@${PNPM_VERSION}"
}

# Bots never run unsandboxed, so bubblewrap must be on the host.
install_bwrap() {
  if command -v bwrap >/dev/null; then return; fi
  say "Installing bubblewrap (needs sudo)"
  sudo apt-get update
  sudo apt-get install -y bubblewrap
}

bwrap_works() {
  bwrap --unshare-user --ro-bind / / true 2>/dev/null
}

# Ubuntu 24.04 and later block user namespaces unless a program has a profile. The profile covers /usr/bin/bwrap only;
# the restriction stays on for everything else. Checking bwrap itself, not the profile file, also loads a profile
# that was copied but never loaded. If bwrap still fails afterwards, the profile was not the cause, so the script
# says so and carries on; the server explains the failure in /api/health and runs no bots.
install_apparmor_profile() {
  local restricted="/proc/sys/kernel/apparmor_restrict_unprivileged_userns"
  if [ ! -f "$restricted" ] || [ "$(cat "$restricted")" != "1" ]; then return; fi
  if bwrap_works; then return; fi
  say "Installing the AppArmor profile for bwrap (needs sudo)"
  sudo install -m 0644 "$REPO/deploy/apparmor-bwrap" /etc/apparmor.d/bwrap
  sudo apparmor_parser -r /etc/apparmor.d/bwrap
  bwrap_works || echo "warning: bwrap still can't create a sandbox, so bots won't run. /api/health gives the reason."
}

# Installs what the server and the dashboard need, and leaves out the Windows and Android apps.
install_dependencies() {
  say "Installing dependencies"
  (cd "$TARGET" && "$PNPM" install --frozen-lockfile --filter "@botsman/server..." --filter "@botsman/web...")
}

build_dashboard() {
  say "Building the web dashboard"
  (cd "$TARGET" && "$PNPM" --filter @botsman/web build)
}

# The service reports the commit and branch it runs in /api/health.
install_service() {
  say "Installing the systemd user service $SERVICE"
  local unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$unit_dir"
  sed -e "s|@NODE@|$(command -v node)|" -e "s|@REPO@|$TARGET|" -e "s|@DESCRIPTION@|$DESCRIPTION|" -e "s|@PORT@|$PORT|" \
    -e "s|@DATA_DIR@|$DATA_DIR|" -e "s|@BACKUP_DIR@|$BACKUP_DIR|" -e "s|@COMMIT@|$(git -C "$TARGET" rev-parse --short HEAD)|" \
    -e "s|@BRANCH@|$BRANCH|" -e "s|@PREVIEW@|$PREVIEW|" "$REPO/deploy/botsman.service" > "$unit_dir/$SERVICE.service"
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE.service"
  # Restarting also starts the new code when the service was already running.
  systemctl --user restart "$SERVICE.service"
  # Keeps the service running while the owner is logged out.
  loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" ||
    echo "Run 'sudo loginctl enable-linger $USER' so Botsman keeps running after you log out."
}

print_release_next() {
  cat <<NEXT
It accepts HTTPS only. Put TLS in front of it, for example:
  tailscale serve --bg --https=443 http://127.0.0.1:$PORT
or a Caddy site block:
  botsman.example.com {
    reverse_proxy 127.0.0.1:$PORT
  }
Then open the app, enter the address, and finish first-run setup.
Check sandboxes with: curl -s -H 'x-forwarded-proto: https' http://127.0.0.1:$PORT/api/health
To update to a newer release later, run deploy/install.sh again.
NEXT
}

print_preview_next() {
  cat <<NEXT
It runs $BRANCH from $TARGET, with its own data in $DATA_DIR. Put TLS in front of it on its own port, for example:
  tailscale serve --bg --https=8443 http://127.0.0.1:$PORT
Then open a preview app, enter that address, and finish first-run setup.
Run deploy/install.sh --preview <branch> again for a newer commit or another branch.
Remove it with: systemctl --user disable --now botsman-preview
NEXT
}

parse_args "$@"
configure
if [ "$MODE" = "preview" ]; then checkout_preview; else checkout_release; fi
check_node
check_pnpm
install_bwrap
install_apparmor_profile
install_dependencies
build_dashboard
install_service

say "$DESCRIPTION is running on 127.0.0.1:$PORT"
if [ "$MODE" = "preview" ]; then print_preview_next; else print_release_next; fi
