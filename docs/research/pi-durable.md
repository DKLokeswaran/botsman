# Pi Durable

Facts checked against the Pi source at commit `7dc38ff` and npm version 1.5.0, as of 2026-11-03. Test results used Node 24.21, SQLite storage, and Pi's scripted faux provider, so no real provider was contacted.

## How Pi is organised

| Package | What it is |
| --- | --- |
| `pi-ai` | Model access: providers, streaming, tool-call formats |
| `pi-agent-core` | A simple agent loop that holds state in memory and emits events |
| `pi-coding-agent` | The Pi CLI, and the Pi SDK, which embeds the same code in a Node process |
| `pi-durable` | A separate agent runtime that saves everything to storage |
| `pi-mcp` | A standalone MCP client, with OAuth |
| `pi-env` | Runs an agent's tools on another machine, or as another process |
| `pi-schema` | JSON Schema builders and validation, with no `eval` |

The CLI and SDK are one product. Pi Durable is a different runtime: it uses `pi-ai`, doesn't use `pi-agent-core`, and the CLI doesn't import it. Skills and MCP from the coding agent don't carry over automatically.

## What it does

The README defines it as "a durable agent harness". Conversations, model turns, tool calls, and app state are committed to storage before anything is shown. If the process dies mid-turn, reopening storage picks up the work. A model call cut off mid-request is retried, up to `settings.restartLimit`, which defaults to 5.

It started as "Pico" on 2026-09-11, moved to its own package on 2026-09-18, reached 1.0.0 on 2026-10-01, and 1.5.0 on 2026-11-02. The README labels it experimental, and 1.5.0 lists 34 breaking changes.

The repo states no intended use. Its docs and 36 examples point to long-running or hosted agents that can't lose work. Most examples are coding scenarios.

## Features we rely on

| Need | Pi feature |
| --- | --- |
| Storage | `openNodeSqliteStorage(file)`. One process owns a storage at a time. |
| Approvals | A `beforeTool` hook, with task memos so a rerun doesn't ask twice |
| Routines | `runtime.sleepUntil` for durable sleep. Pi has no cron, so we write the schedule task. |
| Posting without a reply | `submit({ type: "write" })`, with `model` content for what the model should see |
| Live updates | `watch()`, which emits Chord edit operations on the conversation state. There is no event API. |
| Stop and steer | `conversation.abort()`, and `whenBusy: "steer"` on input |
| Per-chat model | `configure({ model, thinkingLevel })` |
| Compaction | Settings per model, a manual `compact(instructions)`, and a `beforeCompact` hook that can decline or supply a summary |
| Usage | `pi.usage`, per model and per tool |
| Tools | `read`, `write`, `edit`, `bash`, through an `ExecutionEnv` |
| Redaction | An `afterTool` hook can replace a result |

## How prompt sections work

Pi builds the system prompt from named sections, rendered before each request. It compares them with what the model last saw, and if one changed, appends a `pi.system` entry with only that section. Models that accept mid-chat system messages get it in place, so the cached prefix stays intact. Other models get everything collapsed into a leading system message, which loses the cache. After compaction, Pi writes a complete new baseline.

Botsman's memory section therefore stays constant between compactions. See [memory](../decisions/memory.md).

## Test results

| Test | Result |
| --- | --- |
| Many Harness instances | 100 instances with one SQLite file each opened and answered at once: 160 MB of memory, 3.3 s in total |
| Routine post, then a user message | Two separate `user` messages. Pi merges nothing, though the Anthropic API joins them on its side. |
| `watch()` | One callback per commit, carrying Chord operations. The operation format has seven kinds. |
| Approval across a crash | Works. SIGKILL during the wait, then a restart: the tool ran exactly once. The crash counted toward `restartLimit`. |
| Routine with durable sleep | Survived a SIGKILL during the sleep. A write made mid-run joined after the current tool round. |
| Abort and resume | Abort took 222 ms while streaming and 2.7 s during a tool. Aborted partial answers are hidden from the model. |

**One trap.** Several storages on one SQLite file need one shared `NodeSqliteDatabase`, or the second fails with `database is locked`. Botsman uses one file per bot and avoids this.

## What it doesn't provide

Permissions, scheduling, push, login, memory, MCP adapter, skills loader, and embeddings. These are ours to build or adapt.

## Provider sign-in

`pi-ai` handles API keys and OAuth per provider, behind `models.login(provider, method, { prompt, notify })`. OAuth exists for Anthropic, OpenAI, OpenAI Codex, GitHub Copilot, and OpenRouter, among others. GitHub Copilot uses a device code. OpenAI and OpenRouter wait for a redirect to `127.0.0.1` and race it against a pasted address, so they work on a remote server through the paste. Credentials go through a replaceable `CredentialStore`, and tokens refresh automatically. `createProvider()` accepts a custom API implementation, which is how Botsman adds its [Claude subscription provider](../decisions/permissions.md#claude-subscription).

## Other Pi features in v1

Provider coverage, subagents (foreground and background), and code mode, which lets a model script its tool calls in a sandbox. Code mode runs on the server, with no screen of its own. Remote execution over SSH isn't in v1, since it needs a second machine.
