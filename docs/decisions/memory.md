# Memory and notes

## The four files

Each level has two files. The owner writes the `PROFILE` file, and a bot writes the `MEMORY` file.

| File | Level | Written by | Limit |
| --- | --- | --- | --- |
| `USER_PROFILE.md` | Shared by all bots | The owner | 4,000 characters |
| `USER_MEMORY.md` | Shared by all bots | The main bot, with confirmation | 2,000 characters |
| `BOT_PROFILE.md` | One bot | The owner | 6,000 characters |
| `BOT_MEMORY.md` | One bot | That bot, with confirmation | 4,000 characters |

`BOT_PROFILE.md` holds only the bot's role and instructions. That is about 16,000 characters in total, or roughly 4,000 tokens per request. The owner can view and edit all four files in the app.

No bot can write a `PROFILE` file, and that includes the main bot.

Only the main bot writes `USER_MEMORY.md`. If the owner tells another bot something worth keeping, that bot messages the main bot to record it. This means a bot tricked by a malicious page can't plant facts that every bot then trusts, and two bots never write the same file at once.

When a bot-written file is full, the write fails with the current usage, and the bot has to trim it.

## Confirmation

Every bot edit to a memory file asks the owner, in every permission mode. Three things make this work:

- **Files sit outside the bot's folder.** Bots change them only through the memory tool, and notes only through the notes tool. A shell command can't reach them.
- **An edit is an ordinary approval.** The memory tool's `edit_memory` call goes through the same approval as any tool call: the reply waits, the approval expires after the bot's approval wait, stopping the bot cancels it, and it survives a restart. The approval shows the file, the new content, and the content when the bot asked. The apps draw it as "<bot> wants to change <file>", with the lines added and removed and a little context around them, and Confirm or Reject. It shows the conversation it came from, so a bad fact can be traced.
- **Each edit is allowed on its own.** "Allow for this chat" doesn't apply to memory edits, so the apps offer only Allow and Deny.

Who may write the file and its character limit are checked before the owner is asked, so the owner never allows an edit that then fails. Allowed, the tool writes the file and says so; denied, expired, or cancelled, the bot gets the usual refused tool result and the file is unchanged.

Notes are not covered by this. A bot tracking its projects would otherwise ask constantly.

## Keeping the prompt cache

Model providers build the cache in order: tools, then system prompt, then messages. A change to the system prompt invalidates everything after it, which loses the cached chat. Bots have endless chats, so this matters.

While the cache is alive, Botsman keeps the memory section of the prompt frozen and sends changes as messages:

| Change | What happens |
| --- | --- |
| The owner edits `USER_PROFILE.md` | Every bot gets the change with its next incoming message |
| The owner edits `BOT_PROFILE.md` | That bot gets the change with its next incoming message |
| The main bot's edit to `USER_MEMORY.md` is confirmed | Every other bot gets the change with its next incoming message |
| A bot's edit to its own `BOT_MEMORY.md` is confirmed | That bot gets the change with its next incoming message |

The change text is stored as part of that message, so the same bytes go out on every later request and the cache stays valid. The apps don't display it. Nothing is added to idle conversations.

### Rewriting the prompt

Two events leave nothing in the cache to protect, so the server rewrites the frozen section with the current files and sends no change text:

- The first message after the cache has expired, such as when the owner returns to a bot after a break.
- Compaction.

Every model runs with Pi's `supportsMidConvoSystemMessages` setting off, so a request has one system prompt. The server enforces this with a hook that collapses system messages before every request, whatever a model's catalog entry says.

The server judges expiry from the time of the bot's last message or finished reply and the provider's cache lifetime, taken as 5 minutes. A wrong guess costs one cache rebuild. After a server restart the server doesn't know the last reply's time, so the first message may rewrite the prompt.

On a Claude subscription, the new prompt goes in when the `claude` process next starts. See [Claude subscription](permissions.md#claude-subscription).

Pi's default on current models keeps the old prompt and adds the update after it. With the setting off, the request has only the new prompt, at the top. We checked this by inspecting the requests Pi sends, but not yet in a full bot conversation.

### How other products handle this

| Product | Approach |
| --- | --- |
| Hermes | Freezes memory at session start, and refreshes at compression. Long sessions go stale ([#66025](https://github.com/NousResearch/hermes-agent/issues/66025)). |
| OpenClaw | On some routes, pins the system prompt and sends changes as instruction messages after the current turn |

## Saving before compaction

Botsman controls compaction through Pi's settings and its manual `compact()` call. When a chat nears the limit, the server gives the bot one turn to save what matters, then starts compaction. Pi's automatic compaction stays on as the safety net, for example when a provider rejects a request as too long.

In that turn the bot writes to its notes, and edits `BOT_MEMORY.md`. The main bot can also edit `USER_MEMORY.md`. Each memory file edit waits for the owner's approval, so compaction starts only after the owner has answered every edit from that turn. Notes are written at once.

| Threshold | Where |
| --- | --- |
| Save turn | After a reply whose context reaches the model's context window minus 32,768 tokens |
| Pi's own compaction | When the next request would pass the context window minus 16,384 tokens. Pi's background compaction is off, so this is the only automatic one. |

The save turn shows in chat as a notice, and its request id is tied to the reply that crossed the threshold, so a restart never asks twice. When a restart lands between the save turn and its compaction, the compaction runs when the bot opens again. A save turn counts as finished only when the answer Pi recorded for it ends the turn on its own, rather than stopping for tool calls, being cut off at the output limit, failing, or being stopped. Messages the owner sends during the save turn don't change this. One that didn't finish may have saved too little, so no compaction follows it, and the owner's next reply near the limit asks for the save again; the save turn's own replies never start another. Each save turn's request id is stored with its entry, so after a restart the server checks that same submission instead of starting another, and a finished save turn is compacted even if the owner wrote meanwhile. A compaction that fails is retried at the next check; the save turn is not asked again. Models with a context window of 32,768 tokens or less skip the save turn and rely on Pi's compaction.

## Notes

Notes are plain Markdown files that hold what doesn't fit a small file, such as the projects a developer bot tracks. A note's name is a plain file name ending in `.md`, with no folders. They live in `bots/<id>/notes/`, outside the bot's folder, so `ls` and `grep -r` in that folder never spend tokens on them. They reach the model only when the bot opens one.

Two tools keep the two kinds apart. The `memory` tool reads the memory files, one or all four, and asks to edit `BOT_MEMORY.md`, or `USER_MEMORY.md` for the main bot; each edit waits for the owner. The `notes` tool lists, searches, reads, writes, and deletes notes, which take effect at once. Each action and field says in the tool's description what it is for and which fields it needs. Hermes has a `memory` tool too, and OpenClaw has `memory_search` and `memory_get`.

This has two costs. A bot can't run shell scripts over its notes, and folder snapshots don't cover them.

`BOT_MEMORY.md` can point to them, for example "project status lives in notes".

In the apps, memory files and notes open read-only, rendered as Markdown. Edit turns one into a text box with Save and Cancel, so a stray tap can't change what a bot relies on. The owner reads, writes, renames, and deletes notes. A rename saves the note under its new name and then removes the old file, since the server has no rename of its own. A rename or a new note never takes the name of another note: the server writes it only when no note has that name, even when two devices save at once, and saving says that note already exists. A new note starts as `untitled.md`, or the next free `untitled-<n>.md`. The memory screen shows the bot's pending memory edits above the files, and loads the files again when one is answered.

SQLite holds only the search index, an FTS5 table that can be rebuilt from the files at any time. Before each search, the server re-indexes any file that changed, so no file watcher is needed.

## Search later

Vector search goes behind the same `memory` tool. The cost in money is small, and most of the work is keeping the index current.

| Cost | Figure |
| --- | --- |
| API embeddings | About $0.01 for 1,000 notes of 500 tokens each, at $0.02 per million tokens |
| Local model (`bge-small`, quantized) | 55 ms per chunk, about 130 MB more RAM, a 34 MB model, about 475 MB of packages |
| Storage (`sqlite-vec` 0.1.9) | 10,000 chunks: 15 MB and 10 ms a search at 384 dimensions, 61 MB and 35 ms at 1,536 |

Local figures were measured on a 6-core machine, with random vectors for the search test. `pi-ai` has no embedding support, so this is ours to build. A local model is the first choice: no extra key, and notes stay on the server.

Third-party memory providers can fit the same interface, or arrive through MCP. Hermes runs one external provider alongside its built-in files, and OpenClaw combines keyword and vector search in SQLite.
