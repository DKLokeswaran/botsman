#!/usr/bin/env bash
# Installs the Botsman server for the current user: checks Node and pnpm, sets up bubblewrap and its AppArmor
# profile, installs dependencies, and starts a systemd user service. Installing bubblewrap and the profile needs root,
# and so does lingering when logind refuses it.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PNPM_VERSION="12.18.0"
NODE_MAJOR="24"
PNPM="pnpm"

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nerror: %s\n' "$*" >&2; exit 1; }

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

install_dependencies() {
  say "Installing dependencies"
  (cd "$REPO" && "$PNPM" install --frozen-lockfile)
}

install_service() {
  say "Installing the systemd user service"
  local unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$unit_dir"
  sed -e "s|@NODE@|$(command -v node)|" -e "s|@REPO@|$REPO|" "$REPO/deploy/botsman.service" > "$unit_dir/botsman.service"
  systemctl --user daemon-reload
  systemctl --user enable --now botsman.service
  # Keeps the service running while the owner is logged out.
  loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" ||
    echo "Run 'sudo loginctl enable-linger $USER' so Botsman keeps running after you log out."
}

check_node
check_pnpm
install_bwrap
install_apparmor_profile
install_dependencies
install_service

say "Botsman is running on 127.0.0.1:7600"
cat <<'NEXT'
It accepts HTTPS only. Put TLS in front of it, for example:
  tailscale serve --bg --https=443 http://127.0.0.1:7600
or a Caddy site block:
  botsman.example.com {
    reverse_proxy 127.0.0.1:7600
  }
Then open the app, enter the address, and finish first-run setup.
Check sandboxes with: curl -s -H 'x-forwarded-proto: https' http://127.0.0.1:7600/api/health
NEXT
