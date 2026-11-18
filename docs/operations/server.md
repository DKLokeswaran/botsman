# Running the server

## Install

On the server, as the owner's user:

```bash
git clone <repo> botsman && cd botsman
deploy/install.sh
```

The script:

1. Fetches the tags and checks out the newest server release, the highest `server-v<version>` tag, then carries on with that release's own copy of the script. With no `server-v*` tag in the repo it stops. Local changes to tracked files stop it too, until they are committed or discarded.
2. Checks for Node 24. If pnpm 12.18.0 is not on the `PATH`, installs it under `~/.local`, which works when Node is installed system-wide.
3. Installs bubblewrap through `apt-get`, after refreshing the package lists, if it is missing. This needs `sudo`.
4. On hosts that restrict user namespaces, such as Ubuntu 24.04 and later, installs `deploy/apparmor-bwrap` as `/etc/apparmor.d/bwrap` and loads it, unless `bwrap` can already create a sandbox. This needs `sudo`. Because the check tries `bwrap` itself, running the script again loads a profile that was copied but failed to load. If `bwrap` still fails after loading, the script prints a warning and carries on.
5. Runs `pnpm install --frozen-lockfile` for the server and the web dashboard, leaving out the Windows and Android apps.
6. Builds the web dashboard into `apps/web/dist`, which the server serves under `/app`.
7. Installs `deploy/botsman.service` as the `botsman` systemd user unit, with the commit it checked out, then starts or restarts it and turns on lingering so it keeps running after the owner logs out. Lingering uses `sudo` when logind refuses it without. If that fails too, the script prints the command to run by hand and carries on.

Nothing else needs root. Ubuntu adds `~/.local/bin` to the `PATH` at the next login, so `pnpm` is on hand for commands such as the backup. The server runs its TypeScript sources directly on Node 24, with no build step. The dashboard is the only part the install builds.

If sandboxes don't work, the server still starts, explains why in `/api/health`, and refuses to run bots.

## Web dashboard

The dashboard is at `/app/` on the server's address, and the bare address sends a browser there. If the dashboard's files are missing, `/app/` answers 503 with `dashboard_missing`. Running `deploy/install.sh` again builds them.

## Updating

```bash
deploy/install.sh
```

Run it in the server's Botsman folder. It checks out the newest server release, never the newest commit on `main`, rebuilds the dashboard, and restarts the service. The server and the dashboard always come from the same release.

The server looks for a newer release when it starts and once a day after, with `git ls-remote` on the checkout's `origin`, so a server installed from a fork sees the fork's releases. `/api/health` reports the newest release it found as `latestVersion`. When it is newer than the running version, the server section of Settings, in both apps and the dashboard, says so and shows the command above. The "Update the server" screen, shown when an app is too new for the server, shows the same command. The apps learn about a release when they connect, and can't update the server themselves.

## Preview server

A preview server runs a branch under test on the same machine as the real server, without touching the real server's service, port, or data.

```bash
deploy/install.sh --preview <branch>
```

Run it from the real server's checkout. It differs from the real server like this:

| | Real server | Preview server |
| --- | --- | --- |
| Code | Newest `server-v*` tag in the Botsman folder | The branch, from `origin`, in `~/botsman-preview`, which the first run clones |
| systemd user unit | `botsman` | `botsman-preview` |
| Port | 7600 | 7601 |
| Data | `~/.botsman` | `~/.botsman-preview` |
| Backups | `~/.botsman-backups` | `~/.botsman-preview-backups` |
| `/api/health` | Version and commit | Version, commit, branch, and `preview: true` |
| Release check | Daily | None |

Each run fetches the branch again and checks out its newest commit, throwing away changes made by hand in `~/botsman-preview`. The install steps come from the script being run, not from the branch, so testing an old branch never touches the real server's unit. Settings shows a preview server as "Server 0.2.0 · Preview of fix-login at abc1234", and never offers it a release.

The preview server needs its own TLS address, for example `tailscale serve --bg --https=8443 http://127.0.0.1:7601`. Sign the preview apps in to it, so code under test never reaches the real server or the real apps. Its backups run like the real server's. A backup by hand needs its folders: `BOTSMAN_DATA_DIR=~/.botsman-preview BOTSMAN_BACKUP_DIR=~/.botsman-preview-backups pnpm --filter @botsman/server backup`.

Remove it with `systemctl --user disable --now botsman-preview`, then delete `~/botsman-preview` and `~/.botsman-preview` if they are no longer wanted.

## TLS

The server listens on `127.0.0.1:7600` and accepts only HTTPS requests. Every request must either arrive over the server's own TLS, or come from a trusted proxy that sends `X-Forwarded-Proto: https`.

| Setup | How |
| --- | --- |
| Caddy | `reverse_proxy 127.0.0.1:7600` in the site block. Caddy sends `X-Forwarded-Proto`. |
| Tailscale certificate | Run `tailscale cert`, then set `BOTSMAN_TLS_CERT` and `BOTSMAN_TLS_KEY` to the files, and `BOTSMAN_HOST` to the tailnet address |
| Tailscale Serve | `tailscale serve --bg --https=443 http://127.0.0.1:7600`. Serve connects from `127.0.0.1` and sends `X-Forwarded-Proto: https`, replacing any `X-Forwarded-*` header the client sent, so `X-Forwarded-For` holds the device's real tailnet address. |

## Settings

The systemd unit sets these as `Environment=` lines. The install script fills in the port, the data and backup folders, the commit, the branch, and the preview flag.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BOTSMAN_DATA_DIR` | `~/.botsman` | All server state |
| `BOTSMAN_HOST` | `127.0.0.1` | Listen address |
| `BOTSMAN_PORT` | `7600` | Listen port, 0 to 65535 |
| `BOTSMAN_TRUST_PROXY` | `127.0.0.1,::1` | Proxy addresses whose `X-Forwarded-*` headers count |
| `BOTSMAN_TLS_CERT`, `BOTSMAN_TLS_KEY` | unset | Certificate and key files for the server's own TLS |
| `BOTSMAN_BACKUP_DIR` | `~/.botsman-backups` | Where nightly backups go |
| `BOTSMAN_BACKUP_HOUR` | `3` | Local hour of the nightly backup, 0 to 23 |
| `BOTSMAN_BACKUP_KEEP` | `7` | Backups kept, 1 to 365; older ones are removed |
| `BOTSMAN_DASHBOARD_DIR` | `apps/web/dist` in the repo | The built web dashboard's files |
| `BOTSMAN_SCRIPT_MODEL` | unset | `1` adds the scripted test model. Tests only. |
| `BOTSMAN_COMMIT`, `BOTSMAN_BRANCH` | unset | The commit and branch the install script checked out, reported in `/api/health` |
| `BOTSMAN_PREVIEW` | unset | `1` marks a preview server, which reports `preview: true` and never looks for releases |

A number setting outside its range, or not a whole number, stops the server at startup with the reason.

The server never reads model provider keys from its environment. Keys and sign-ins come only from the apps.

## Backups

Every night at `BOTSMAN_BACKUP_HOUR`, the server writes one backup folder named after the time, and keeps the newest `BOTSMAN_BACKUP_KEEP`. To write one now: `pnpm --filter @botsman/server backup`.

| In a backup | How it is copied |
| --- | --- |
| `data/server.db` and every `data/bots/<id>/session.sqlite` | SQLite's online backup, safe while the server runs |
| Memory files, notes, and the default bot folders | Copied as files, under `data/` |
| Bot folders outside `~/.botsman`, deleted bots' included | Copied as files, under `folders/<bot id>/` |
| `secret.key` | Never copied |

A backup is written to `<name>.partial` and renamed only once complete. Each backup is a full copy, so a bot folder holding large repos costs that much disk every night. A deleted bot's folder outside `~/.botsman` stays in every backup until the owner removes the bot's folder from disk.

Leaving `secret.key` out means a stolen backup can't decrypt provider keys. It also means a restore onto a new server needs the keys entered again, unless the owner keeps their own copy of `secret.key`.

## Restore

1. Stop the server: `systemctl --user stop botsman`.
2. Move the current data folder aside: `mv ~/.botsman ~/.botsman.broken`.
3. Copy the backup's data back: `cp -a ~/.botsman-backups/<name>/data ~/.botsman`.
4. For each folder under `folders/`, copy it back to the bot's folder path. `sqlite3 ~/.botsman/server.db "SELECT id, folder FROM bots"` lists the paths.
5. Copy back `secret.key` if you kept one. Without it the server makes a new key, and provider keys and sign-ins must be entered again in the apps. Signed-in devices also sign in again, because access tokens are signed with a key derived from it.
6. Start the server: `systemctl --user start botsman`.

Pi recovers each bot's conversation on start. A reply that was running when the backup was taken carries on as after a crash.

## Tests

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
```

Tests use Pi's faux provider through the scripted model in `server/src/testing/script-model.ts`, so they make no model requests and cost nothing. The sandbox tests skip themselves when bubblewrap can't start. `server/test/e2e/` holds a client that uses only the `protocol` package, and runs the M1 scenario over HTTP and the WebSocket.
