# Permissions

## Why we don't judge commands

Nothing can reliably tell whether a command is destructive.

- **Pattern lists get bypassed.** Base64 and subshells beat Cursor's denylist, and Cursor dropped it. Its later allowlist had bypasses too.
- **Classifiers miss things.** Anthropic's auto mode missed 17% of real overeager actions in its own test. The usual failure was deciding that vague consent, like "clean up the PR", covered a force-push.

So Botsman limits what a command can do, then asks about anything beyond that.

## The three layers

**A sandbox sets the boundary.** Every file operation and command a bot runs goes through its own [bubblewrap](https://github.com/containers/bubblewrap) sandbox. The sandbox is an allow list: the bot sees system programs and skills read-only and its own folder read-write, and nothing else exists for it. That hides the owner's home, `~/.claude`, SSH keys, other bots' folders, memory files, notes, and the server's data. `rm -rf /` can't reach any of them, however it's spelled, and a prompt-injected bot is contained. The main bot's [`host_bash`](#host_bash) is the one tool that runs outside a sandbox, and it is off by default.

**Inside its folder, a bot runs freely.** Folder snapshots let the owner undo a bad delete.

**Leaving the boundary is the approval.** That covers anything outside the folder, and MCP tools marked destructive. The bot's mode decides what happens:

| Mode | Behaviour |
| --- | --- |
| Manual | Always asks the owner. The default for a new bot. |
| Smart | A classifier decides. Any uncertainty or failure asks the owner. Until the classifier exists, Smart runs like Off. |
| Off | Runs without asking |

MCP tools marked destructive always ask, in every mode, and so do memory edits.

Smart is a real setting the protocol and apps accept. In the server it calls the same path as Off, through one function that the classifier replaces, so nothing else changes when the classifier arrives. The apps show fixed text next to the Smart option: "Smart currently runs like Off."

### What counts as leaving the folder

Commands are never judged, so `bash` always counts as inside: the sandbox limits what it reaches. The `read`, `write`, and `edit` tools leave when their path resolves outside the bot's folder. The path is judged as Pi uses it: a leading `@` dropped, Unicode spaces made plain, `~` expanded to the bot's folder, `file://` URLs turned into paths, and symbolic links followed to where they point. Because `read` also tries other spellings of a missing file, a call leaves if any of those spellings resolves outside the folder. Any other tool without its own rule counts as leaving, so it asks. The `memory` tool counts as inside, because it reaches only the bot's own notes and memory files. Its `edit_memory` call is the exception: it always asks, in every mode, and "Allow for this chat" doesn't cover it. See [Confirmation](memory.md#confirmation).

An approval doesn't widen the sandbox. An allowed read of `/etc/hostname` works because the sandbox shows `/etc`; an allowed write outside the folder still fails, because nothing outside it is writable.

## How the sandbox is set up

The server runs as the owner's user, and starts one `bwrap` sandbox per bot. Pi's file and shell tools reach it through a `pi-env` daemon started inside the sandbox.

| Inside the sandbox | Access |
| --- | --- |
| `/usr` and `/etc` | Read-only |
| `/bin`, `/sbin`, `/lib`, `/lib32`, `/lib64`, `/libx32` | The same links into `/usr` as on the host, or read-only folders on hosts without a merged `/usr` |
| The DNS resolver folder, when `/etc/resolv.conf` points outside `/etc` (`/run/systemd/resolve` on systemd-resolved hosts) | Read-only |
| The `pi-env` daemon program, at `/run/botsman/pi-env` | Read-only, so the bot doesn't see where Botsman is installed |
| `~/.agents` and Botsman's shared `skills/` | Read-only |
| The bot's folder, wherever the owner put it | Read-write |
| `/proc`, `/dev`, `/tmp` | The sandbox's own private copies |
| Everything else, including the rest of `/home`, `/sys`, `/opt`, `/var`, and `/root` | Doesn't exist |

Toolchains installed in the owner's home, such as nvm, pyenv, or cargo, are hidden. A bot that needs one installs it in its own folder.

Paths are added only when a common command such as `git`, `npm`, or `pip` needs one.

- **Namespaces.** Each sandbox has its own user, process, IPC, UTS, and cgroup namespaces. Bots can't see or signal each other's processes, the server's, or the owner's.
- **Privileges.** All capabilities are dropped and new privileges are blocked, so `sudo` and `su` can't work. `--disable-userns` stops a bot creating namespaces of its own.
- **Environment.** The server's environment is cleared. A bot gets only `PATH`, `HOME`, and `TMPDIR`.
- **Skills.** `~/.agents` is mounted at its real full path, and only if it exists. Inside the sandbox `HOME` is the bot's folder, so `~/.agents` means the bot's own `.agents` folder, and that's where its own skills live. Anything the owner later puts in the real `~/.agents` becomes readable by every bot.
- **Network.** The network toggle decides whether the sandbox shares the host's network. With it off, only the sandbox's own loopback exists.
- **Failure.** Bots never run unsandboxed. If `bwrap` is missing or can't start, setup says why and the server refuses to run bots.

### Stop and crashes

Stop ends every process the bot started. It aborts the reply, then always closes the bot's connection, which ends its sandbox and everything in it, including processes that left their group and anything else running in that sandbox at the time. The next tool call opens a new connection, which starts a new sandbox. The bot's folder stays, and `/tmp` starts empty.

In M1 a bot runs only its chat with the owner, so Stop affects nothing else. Once routines share a bot's sandbox, Stop in the chat also ends a routine command running at that moment.

A server crash ends every sandbox at once, so nothing keeps running unattended. After restart, Pi doesn't rerun an interrupted command. It tells the model the command was interrupted and may have partially run, and the conversation carries on.

### Installing

Bubblewrap needs a user namespace. Ubuntu 24.04 and later block them through AppArmor unless a program has a profile, and Canonical ships none for `bwrap`. Installing on those systems takes two root steps:

```text
sudo apt install bubblewrap

# /etc/apparmor.d/bwrap, loaded with: sudo apparmor_parser -r /etc/apparmor.d/bwrap
abi <abi/4.0>,
include <tunables/global>

profile bwrap /usr/bin/bwrap flags=(unconfined) {
  userns,

  include if exists <local/bwrap>
}
```

The install script uses the `bwrap` already on the host, and installs it through the package manager if it's missing. The profile attaches to one path, and a copy of `bwrap` without a profile fails on these systems. Botsman never turns the restriction off system-wide, and no root is needed after install.

### What has been tested

**The sandbox has been tested on two setups:** Ubuntu 24.04, kernel 6.8, x86-64, and bubblewrap 0.9.0, as of 2026-11-06; and Debian 12, kernel 6.1, x86-64, and bubblewrap 0.8.0, as of 2026-11-16. Both used Pi's real tools and its faux model provider. It has not been run with a real model, after a host reboot, on arm64, or on any other distro. Debian 12 doesn't restrict user namespaces, so it needs no AppArmor profile. Ubuntu, Pi's daemon, and the Agent SDK all publish arm64 builds.

The server's own tests, in `server/test/integration/sandbox.test.ts` and `crash.test.ts`, check on every run that the owner's home, keys, and Botsman's data stay hidden, that system folders are read-only with no capabilities, that the network toggle works, that Stop ends a process that left its group, and that killing the server ends every sandboxed process. They passed on the Ubuntu setup on 2026-11-09, and on the Debian setup, after a run of `deploy/install.sh`, on 2026-11-16. The table below is from the Ubuntu setup.

| Test | Result |
| --- | --- |
| 18 everyday commands, including `git`, `npm`, `pip`, and `gcc` | All worked |
| Stop during a command, with a process that left its group | The command ended at once. The other process ended within 100 ms of closing the connection. The next tool call worked on a new connection. |
| Server force-killed, three bots running commands, three times | Every sandbox and process ended. After restart no command reran, and each chat continued. |
| Network on | Reached services on localhost, abstract sockets, the host's Tailscale and public addresses, the Docker gateway, a container, and another Tailscale device |
| Network off | Reached none of those. Only the sandbox's own loopback exists. |
| Docker socket | Hidden with the network on or off |
| Sandbox start time | About 30 ms, and 117 ms at the 95th percentile |
| `~/.agents` mounted read-only | All 22 skills listed and readable. Writes and deletes failed with "Read-only file system". `~/.ssh` and `~/.claude` stayed hidden. |
| Bot folder outside `~/.botsman`, with spaces in its path | Worked. A folder on a second disk has not been tested. |

### Other assistants

OpenClaw and Hermes run on the host unless the owner turns a sandbox on, and both offer Docker as one. NanoClaw runs each group in a container by default. Botsman keeps the sandbox always on, because its bots run unattended and read untrusted pages.

## The classifier

Smart mode's classifier sees only the owner's messages and the tool calls, never tool output. A malicious web page can't talk it into anything. It works the way Anthropic describes for auto mode.

## Approvals

- The owner answers Allow once, Allow for this chat, or Deny. Allow for this chat covers later calls of the same tool in the same chat.
- The wait is per bot, 1 hour by default. If unanswered, the action is refused and the bot is told.
- Stop cancels a waiting approval, and deleting a bot cancels its pending ones.
- A request is stored, so it survives a server restart and every device sees the answer.
- A crash during a wait counts toward Pi's `restartLimit`, so the server raises that limit.

## Main bot

The main bot alone can change other bots and write `USER_MEMORY.md`. Like every bot, it can't write a `PROFILE` file. Its normal tools stay confined to its own folder, and it acts on other bots through server tools rather than raw file access.

- Reading another bot's files, notes, or chats doesn't ask.
- Every change to another bot goes through its approval mode.
- If another bot asks the main bot to change something, that always asks the owner and names the bot that asked. Otherwise a confined bot could get around its limits by asking.

### host_bash

`host_bash` is a real shell on the host, so the main bot can diagnose and fix problems in Botsman and on the server. Fixed repair tools would only cover problems predicted in advance.

- It is off by default. Only the owner turns it on, in the apps, and the main bot can't change that switch. Setup explains the choice.
- With it off, the main bot can't look at or change anything outside its sandbox.
- Only the main bot has this tool. Its normal `bash` tool stays sandboxed for everyday work.
- It runs outside the sandbox as the server's user, with that user's files, Docker access, `sudo`, and Botsman's own keys.
- It follows the main bot's approval mode. In Smart mode the classifier decides each command, and asks the owner only if it's unsure or fails.

## Weak spots

- **Network.** A command inside the folder can still send data out. Each bot has a network toggle, on by default, because assistants need the web.
- **Local services.** A bot with network on shares the host's network, so it can try anything the host can reach: services on localhost, Tailscale devices, Docker networks, and Botsman's own API. Anything that doesn't require a login is exposed to a hijacked bot. This is accepted for v1. A bot that doesn't need the web can have network off.
- **Messages from bots and channels.** Bots treat them as information, not as commands from the owner.
- **Resource use.** Bots have no process or memory limits in v1, so a runaway bot can slow or stop the whole server.

## MCP connections

Botsman is a gateway to MCP servers. It connects to whatever servers the owner sets up, and each bot turns connections on or off for itself. Local servers run however the owner configures them, outside the bot sandboxes, and what they can access is the owner's choice.

## Model provider access

Botsman offers every connection method Pi supports for a provider, except Pi's Anthropic sign-in, which the Claude subscription option replaces.

| Provider | API key | Sign-in |
| --- | --- | --- |
| Anthropic | Yes | Claude subscription, through Claude Code |
| OpenAI | Yes | Sign in with ChatGPT |
| OpenRouter | Yes | Browser sign-in that creates a key |
| OpenCode Go | Yes | None |
| GitHub Copilot | No | Device code |

For the other sign-ins, `pi-ai` runs each one on the server through `models.login`, and refreshes tokens itself. The server stores the result through its own `CredentialStore`, and the apps show each step:

- **Device code.** The app shows a code and a link, and the owner enters the code on that page.
- **Browser sign-in.** The app opens the provider's page. The provider then shows a code, or redirects to a local address on the owner's device, where nothing is listening and the page fails to load. The owner pastes the code or address into the app, which sends it to the server.

The apps always show the manual paste, because the server usually runs on another machine and can't receive the redirect.

### Claude subscription

A custom `pi-ai` provider runs an unmodified `claude` program through Anthropic's Agent SDK, on behalf of every bot set to a Claude model. API keys for Anthropic still go through Pi directly.

- **Program.** The SDK's bundled copy by default, pinned with the SDK. The owner can set a path to their own `claude` instead, and the server checks its minimum version when a chat starts.
- **Login.** The server runs as the owner, so an existing login in `~/.claude` works as is. The owner can set another folder, which becomes `CLAUDE_CONFIG_DIR`. With no login, the app tells the owner to sign in with Claude Code itself on the server, using `claude` or `claude auth login`. Botsman doesn't use `claude setup-token`, because it would have to store the token.
- **Credentials.** Claude Code keeps the login, Botsman never reads it, and the app only checks the status. Sandboxes hide it from bots, so a bot can't run `claude` with this login as a shell command. All bots share one login, and so one plan limit.
- **Environment.** The server doesn't pass `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` to `claude`. Either one takes priority over a subscription login, so usage would be billed to the key.

Claude Code acts only as the model:

- Its built-in tools, settings files, hooks, skills, MCP servers, memory, and auto-compaction are off. Tool search is off for v1, through `ENABLE_TOOL_SEARCH=false`, so Claude sees all of a bot's tools up front.
- The SDK still sends a billing label, one intro line, and an environment message with the working folder, OS, shell, model name, date, and a note about downloaded files.
- Botsman's tools reach Claude as MCP tools. The provider holds each call, Pi runs it through the normal `beforeTool` approvals, and the result goes back. Tools run one at a time on this provider, because Botsman leaves off the read-only mark that makes the SDK run tools in parallel.
- Pi's history stays the source of truth. Claude Code can't load history it didn't write, so anything it missed after a model switch arrives as one user message. After compaction it starts a new session.
- Each active chat has one `claude` process, stopped after 5 minutes idle. A held tool call counts as active, including an approval wait.
- Botsman's system prompt and steer work the same as on every provider. The prompt goes in the SDK's `systemPrompt`, as `{ type: "custom", prompt, snapshot: false }`, because a plain string keeps the old prompt on resume. The process has to restart to change the prompt, and by the time the cache has expired it has already stopped for being idle, so [a rewrite](memory.md#rewriting-the-prompt) needs no new Claude session. Steer goes in as a queued message. During a held tool call the model gets it with the tool result, and during a reply it goes as the next message.
- Usage shows tokens and the cost the SDK reports. On a subscription, that cost is the API price of the message, not a charge.
- The Claude subscription form has a **Usage label** option, Default or Botsman, set to Default. Default sends the SDK's own label. Botsman sets `CLAUDE_CODE_ENTRYPOINT`, which changes the `User-Agent` and the `cc_entrypoint` billing header, and applies the next time `claude` starts. Anthropic doesn't document this variable, so the form says that using it may affect the account. An [issue report](https://github.com/anthropics/claude-code/issues/97074) measured the 5-hour limit draining about 1.8 times faster under `sdk-cli`. We have not measured this, and nothing confirms an effect on the weekly limit.

OpenCode's Claude Agent provider uses this design, and its [spec](https://github.com/anomalyco/opencode/blob/dev/specs/v2/claude-agent-provider.md) is the reference.

Tests with SDK 0.3.318, as of 2026-11-06:

- The SDK reads an existing login from `~/.claude` or `CLAUDE_CONFIG_DIR`, and a real login answered a real request.
- An API key or auth token overrides the login. With no login, the request fails with "Not logged in".
- Against a fake API with a fake login, resuming with a plain string prompt sent the old prompt. Resuming with `snapshot: false` sent the new prompt and kept the history. The SDK docs call this prompt recording "rolling out", so it needs checking on a real login.
- If the `claude` process dies during a held tool call, the SDK throws an error and tells the tool to stop. How Pi recovers from that still needs testing once the provider exists.

The app states Anthropic's restriction on that form. See [risks](../risks.md).

## Keys

Model provider keys and sign-ins sit in the server process, outside every sandbox, so bots can't read them. `host_bash` is the exception, because it runs as the server's user. Encryption protects mainly backups and stray copies, because the key to decrypt lives on the same server.

Credentials are sealed with AES-256-GCM using `~/.botsman/secret.key`, which backups leave out. The server never reads provider keys from its own environment variables: pi-ai is given a store and no ambient sources, so a key exported in the server's shell can't be billed by accident.

Shell commands get no other secrets in v1. A bot uses an MCP connection instead, which holds its own login.

A key service follows v1, so bots can use API keys they can't read:

- a server-side `http_request` tool, where the bot names a secret and the server adds it to the header
- each secret granted per bot, and tied to allowed hosts
- responses scanned for known secrets, using Pi's `afterTool` hook
- an SSH agent, which signs for the bot without exposing the private key

Passing a key as an environment variable doesn't work, because the bot can run `env`. For scripts that need a key, a placeholder-swapping proxy is the next option to try, starting with Infisical's Agent Vault. Its README steers new users to the Infisical platform.

## Sources

- [Anthropic: how auto mode works](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Backslash: Cursor's denylist](https://www.backslash.security/blog/cursor-ai-security-flaw-autorun-denylist)
- [Cursor allowlist advisory](https://github.com/cursor/cursor/security/advisories/GHSA-534m-3w6r-8pqr)
- [Infisical Agent Vault](https://github.com/Infisical/agent-vault)
- [OpenClaw: sandboxing](https://docs.openclaw.ai/gateway/sandboxing)
- [Hermes: security](https://hermes-agent.nousresearch.com/docs/user-guide/security)
- [Claude Code: authentication](https://code.claude.com/docs/en/authentication)
