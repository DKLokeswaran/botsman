import type { Bot, ChatSnapshot } from "@botsman/protocol";
import { toChatMessage } from "../events/chat-view.ts";
import type { Services } from "../services.ts";

const LOOK_BACK = 50;

// Whether a chat has messages from before the entries the feed holds. Entries the apps don't show, such as
// settings changes, don't count, so a new chat offers no "earlier messages".
export async function earlierInTranscript(services: Services, bot: Bot): Promise<boolean> {
  let before = services.feed.firstEntryId(bot.id);
  while (before !== undefined) {
    const page = await services.engine.history(bot, before, LOOK_BACK);
    if (page.entries.some((entry) => toChatMessage(entry) !== undefined)) return true;
    before = page.hasEarlier ? page.entries[0]?.id : undefined;
  }
  return false;
}

// A chat as an app first sees it. The look back at the transcript happens first, so the snapshot itself is
// read in one step and no event can fall between it and the stream's sequence number.
export async function chatSnapshot(services: Services, bot: Bot): Promise<ChatSnapshot> {
  const earlier = services.sandbox.status.ok ? await earlierInTranscript(services, bot) : false;
  return services.feed.snapshot(bot.id, services.registry.chatSettings(bot), earlier);
}
