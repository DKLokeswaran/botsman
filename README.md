# Botsman

Botsman is a personal assistant you run yourself. A small server on your VPS runs a set of named bots, each with its own purpose, folder, memory, and chat. You talk to them from a Windows app, an Android app, or a web dashboard.

The server stays on all the time, so bots can run routines, wait for your approval, and alert you while the apps are closed.

The server core (milestone M1) is in `server/`, with its message schema in `packages/protocol/`. The apps come next; until then the repo also holds the plan and clickable mockups.

## What's here

| Path | Contents |
| --- | --- |
| [docs/product/PRD.md](docs/product/PRD.md) | What Botsman does |
| [docs/product/roadmap.md](docs/product/roadmap.md) | Build order and release milestones |
| [docs/decisions/overview.md](docs/decisions/overview.md) | Server, apps, and how they connect |
| [docs/decisions/stack.md](docs/decisions/stack.md) | Technology choices and why |
| [docs/decisions/memory.md](docs/decisions/memory.md) | Memory files, notes, and search |
| [docs/decisions/permissions.md](docs/decisions/permissions.md) | What a bot can do, and when it asks |
| [docs/decisions/conversations.md](docs/decisions/conversations.md) | What context each conversation gets |
| [docs/decisions/notifications.md](docs/decisions/notifications.md) | Alerts when the apps are closed |
| [docs/research/pi-durable.md](docs/research/pi-durable.md) | What Pi Durable is, and test results |
| [docs/research/client-versioning-and-updates.md](docs/research/client-versioning-and-updates.md) | How other projects version and update their clients |
| [docs/risks.md](docs/risks.md) | Known risks and how we handle them |
| [docs/operations/server.md](docs/operations/server.md) | Installing and running the server, backups, and restore |
| [server/](server) | The Botsman server |
| [packages/protocol/](packages/protocol) | Every HTTP body and WebSocket message |
| [deploy/](deploy) | Install script, systemd unit, and AppArmor profile |
| [DESIGN.md](DESIGN.md) | The Zoetrik visual design |
| [mockups/](mockups/README.md) | Clickable mockups of every screen |

## Run the tests

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
```

To install the server on a VPS, see [running the server](docs/operations/server.md).

## View the mockups

```bash
python3 -m http.server 8000 --directory mockups
```

Then open `http://127.0.0.1:8000/`.
