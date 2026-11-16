import type { Bot } from "@botsman/protocol";

// A bot's picture: its uploaded photo, or a square with its initial.
export function Avatar({ bot, size = 40 }: { bot: Pick<Bot, "name" | "avatar">; size?: number }) {
  const box = { width: size, height: size };
  if (bot.avatar?.kind === "photo") return <img src={bot.avatar.dataUrl} alt="" style={box} className="shrink-0 rounded-lg border border-border object-cover" />;
  return (
    <span style={box} aria-hidden className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-card font-display text-sm font-bold uppercase">
      {bot.name.trim().charAt(0)}
    </span>
  );
}
