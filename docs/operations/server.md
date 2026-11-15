# Running the server

## Install

On the server, as the owner's user:

```bash
git clone <repo> botsman && cd botsman
deploy/install.sh
```

The script:

1. Checks for Node 24. If pnpm 12.18.0 is not on the `PATH`, installs it under `~/.local`, which works when Node is installed system-wide.
2. Installs bubblewrap through `apt-get`, after refreshing the package lists, if it is missing. This needs `sudo`.
3. On hosts that restrict user namespaces, such as Ubuntu 24.04 and later, installs `deploy/apparmor-bwrap` as `/etc/apparmor.d/bwrap` and loads it, unless `bwrap` can already create a sandbox. This needs `sudo`. Because the check tries `bwrap` itself, running the script again loads a profile that was copied but failed to load.
4. Runs `pnpm install --frozen-lockfile`.
5. Installs `deploy/botsman.service` as a systemd user unit, starts it, and turns on lingering so it keeps running after the owner logs out. Lingering uses `sudo` when logind refuses it without.

Nothing else needs root. Ubuntu adds `~/.local/bin` to the `PATH` at the next login, so `pnpm` is on hand for commands such as the backup. The server runs its TypeScript sources directly on Node 24, with no build step.

If sandboxes don't work, the server still starts, explains why in `/api/health`, and refuses to run bots.

## TLS

The server listens on `127.0.0.1:7600` and accepts only HTTPS requests. Every request must either arrive over the server's own TLS, or come from a trusted proxy that sends `X-Forwarded-Proto: https`.

| Setup | How |
| --- | --- |
| Caddy | `reverse_proxy 127.0.0.1:7600` in the site block. Caddy sends `X-Forwarded-Proto`. |
| Tailscale certificate | Run `tailscale cert`, then set `BOTSMAN_TLS_CERT` and `BOTSMAN_TLS_KEY` to the files, and `BOTSMAN_HOST` to the tailnet address |
| Tailscale Serve | `tailscale serve --bg --https=443 http://127.0.0.1:7600`. Serve connects from `127.0.0.1` and sends `X-Forwarded-Proto: https`, replacing any `X-Forwarded-*` header the client sent, so `X-Forwarded-For` holds the device's real tailnet address. |

## Settings

The systemd unit sets these as `Environment=` lines.

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
| `BOTSMAN_SCRIPT_MODEL` | unset | `1` adds the scripted test model. Tests only. |

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
