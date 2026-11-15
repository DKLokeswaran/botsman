# Known issues

Accepted low-severity issues. Each row is a real issue that has not been fixed yet.

| Issue | Where | Why it is low |
| --- | --- | --- |
| Tokens with extra dot-separated segments are accepted; the extra part is ignored, and the valid parts are still required | `server/src/auth/auth-service.ts` | Grants nothing an attacker didn't already have |
| A pending approval whose waiter never starts (a crash between creating it and saving its memo, or a restart with sandboxes broken) never expires and stays in Needs you | `server/src/permissions/permission-policy.ts` | Rare; answering it does nothing harmful |
| The chat snapshot reports `hasEarlier: true` for any chat with messages | `server/src/events/chat-feed.ts` | Costs one empty history request |
| A folder name starting with `..`, such as `~/.botsman/..x`, counts as outside its parent, so such a folder is accepted inside Botsman's data and `read ..notes.md` asks for approval | `server/src/bots/folder-policy.ts`, `server/src/backup/backup.ts` | The accepted folder is a new, empty one |
| A bot name of only spaces is accepted, `PATCH` doesn't trim names, and a default model with an unknown provider is accepted | `server/src/bots/bot-service.ts`, `server/src/bots/bot-registry.ts` | Owner input only; the bot answers with `model_not_connected` |
| An approved memory edit overwrites an owner edit made to the same file while the approval waited | `server/src/memory/memory-edits.ts` | Needs the owner to edit and then approve the same file |
| Neither WebSocket has a deadline for the first `hello`, so an unauthenticated connection can stay open | `server/src/api/socket.ts`, `server/src/api/alerts-socket.ts` | One idle socket each; messages are capped at 64 KiB |
| The restore steps say devices must sign in again without `secret.key`, but refresh tokens don't need it; the overview places the pre-compaction save in `memory`, but it lives in `engine/compaction-guard.ts` | `docs/operations/server.md`, `docs/decisions/overview.md` | Docs only |
| Two setup requests racing on first run make the loser fail with 500 instead of 409 | `server/src/api/auth-routes.ts` | First run only; the winner is set up correctly |
| Finished provider sign-ins stay in memory until restart | `server/src/providers/provider-logins.ts` | Small, owner-started objects |
| `install.sh` installs pnpm with `npm install --global` whenever the version differs, which fails with EACCES when Node's global prefix is root-owned | `deploy/install.sh` | The error is visible and the step can be run by hand |
| Only the guard's pure logic is tested for a restart between the save turn and its compaction; `BotSession`'s check on open has no integration test | `server/src/engine/bot-session.ts` | The guard's decisions are covered; only the wiring isn't |
| No test covers a rate-limit window expiring, or a sign-in error other than a wrong password giving its count back | `server/src/auth/rate-limit.ts`, `server/src/api/auth-routes.ts` | Parallel and correct-password cases are covered |
