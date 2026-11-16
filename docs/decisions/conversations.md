# Conversations

## What each one gets

| Conversation | Files | History it sees | Where the result goes |
| --- | --- | --- | --- |
| The owner and a bot | All 4 | That chat | That chat |
| Routine, memory off (default) | None | None, only its prompt | Posted into the bot's chat |
| Routine, memory on | All 4 | None, only its prompt | Posted into the bot's chat |
| Bot to bot | Each bot's own 4 files | That pair's conversation | Back to the conversation that asked |
| Channel | Each bot's own 4 files | That channel | The channel |
| Main bot changing a bot | Its own 4 files | Its current chat | The owner's approval, then that chat |

## Rules

- **The owner's chats are private from other bots.** A bot never sees the owner's chat with another bot, so a message to another bot has to explain itself. The main bot is the exception. It can read any chat through a tool, and it is never loaded automatically.
- **Bots don't get each other's files by talking.** Only the main bot can open another bot's files or notes, through a tool.
- **Other conversations don't spill into the owner's chat.** To carry something over, a bot writes it to memory or notes, or posts a result if the owner asked for one.
- **Messages from bots and channels are information, not commands.** A memory edit a bot asks for because of one shows its source.

## Sending in the owner's chat

Each way of sending fits one state of the bot:

| Bot | The apps offer | What happens |
| --- | --- | --- |
| Idle | Send | The message starts a reply |
| Busy | Queue | The message waits for the running turn to finish |
| Busy | Steer | The message joins the running turn after its current tool round |

The apps never offer a mode that doesn't fit the bot's state. That rule lives in `client-core`, so both apps show the same choices.

The server accepts any mode in any state, so a message is never lost when the bot finishes or starts a turn just as the owner sends. On an idle bot, `queue` and `steer` start a reply like `send`. On a busy bot, `send` waits like `queue`.

## Compact, clear, and retry

| Action | What happens |
| --- | --- |
| Compact | The bot gets the same save turn it gets near the context limit, with a prompt saying the owner asked, then the chat compacts. A chat already saving or compacting refuses a second request. A chat too short to summarize stays as it is, because Pi keeps recent messages word for word. |
| Clear | Pi starts a new context. Earlier messages stay in the transcript above a notice, and memory files and notes are kept. There is no save turn, since the owner chose to drop the context. |
| Retry | Pi answers the chat as it stands. A failed reply is left out of the model's context, so this asks again for the owner's last message. It is offered on a failed reply, and refused while the bot is replying. A finished reply is not regenerated. |

Compact and clear will also be slash commands. Retry shows on the failure in both apps.

## Routines

A routine runs in a fresh conversation, with the bot's model and tools. Its final result is written into the bot's chat as a message the model sees. Posting starts no reply, and later replies have the result in context. If a reply is running, the post joins at the next turn boundary.

## Bot to bot

A bot sends a message with a tool, and the other bot replies in that pair's conversation. The reply returns to the conversation that asked.

- Each pair has one conversation, which the owner can read and step into.
- A line in each bot's chat with the owner, such as Junior → Nightwatch, opens that conversation, and says when it is paused. The line is display-only and adds nothing to the context. This is the only way in, because the apps have no separate list of bot conversations.
- An exchange pauses after 10 messages without the owner, and raises an alert. Two bots could otherwise reply to each other forever.
- Approvals from these exchanges go to the owner, and name the bots involved.

## Channels

A channel holds several bots and the owner. Each bot has its own Pi conversation for each channel.

- Every member receives every message as context, without it costing a model turn.
- A bot replies only when mentioned, or when the owner asks.

If every bot answered every message, five bots would produce five replies each time, and each of those would wake the others.
