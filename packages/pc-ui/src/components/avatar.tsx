import type { Bot } from "@botsman/protocol";
import { MARK_STROKE, MARKS } from "@botsman/tokens";

// A bot's picture: its uploaded photo, its chosen mark, or a square with its initial.
export function Avatar({ bot, size = 40 }: { bot: Pick<Bot, "name" | "avatar">; size?: number }) {
  const box = { width: size, height: size };
  if (bot.avatar?.kind === "photo") return <img src={bot.avatar.dataUrl} alt="" style={box} className="shrink-0 rounded-lg border border-border object-cover" />;
  const mark = bot.avatar?.kind === "mark" ? MARKS[bot.avatar.mark] : undefined;
  return (
    <span style={box} aria-hidden className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-card font-display text-sm font-bold uppercase">
      {mark === undefined ? bot.name.trim().charAt(0) : <MarkIcon paths={mark} size={Math.round(size * 0.5)} />}
    </span>
  );
}

export function MarkIcon({ paths, size }: { paths: readonly string[]; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
