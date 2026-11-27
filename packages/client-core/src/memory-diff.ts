import type { Approval } from "@botsman/protocol";

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

// What a memory edit's card writes before each line.
const LINE_PREFIXES: Record<DiffLine["kind"], string> = { added: "+ ", removed: "− ", same: "  " };

const CONTEXT_LINES = 2;

// The lines a memory edit adds and removes, against the file when the bot asked, with a little unchanged context
// around each change. A longest common subsequence keeps the lines that stayed in place.
export function memoryDiff(previous: string, next: string): DiffLine[] {
  const before = previous === "" ? [] : previous.split("\n");
  const after = next === "" ? [] : next.split("\n");
  return trimContext(diffLines(before, after));
}

function diffLines(before: string[], after: string[]): DiffLine[] {
  const common = commonLengths(before, after);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ kind: "same", text: before[i++]! });
      j++;
    } else if (j < after.length && (i === before.length || common[i]![j + 1]! > common[i + 1]![j]!)) {
      lines.push({ kind: "added", text: after[j++]! });
    } else {
      lines.push({ kind: "removed", text: before[i++]! });
    }
  }
  return lines;
}

// common[i][j]: how many lines `before` from i and `after` from j have in common, in order.
function commonLengths(before: string[], after: string[]): number[][] {
  const table = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i]![j] = before[i] === after[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

// Keeps unchanged lines only near a change.
function trimContext(lines: DiffLine[]): DiffLine[] {
  const near = (index: number) => lines.slice(Math.max(0, index - CONTEXT_LINES), index + CONTEXT_LINES + 1).some((line) => line.kind !== "same");
  return lines.filter((line, index) => line.kind !== "same" || near(index));
}

// A memory edit's card: its heading and source line, as the mockup words them, and the lines the edit changes, each
// with its prefix.
export function memoryEditView(approval: Approval, botName: string): { title: string; source: string; lines: DiffLine[] } {
  const edit = approval.memoryEdit;
  const file = edit?.file ?? "a memory file";
  const lines = edit === null ? [] : memoryDiff(edit.previous, edit.content);
  const time = new Date(approval.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { title: `${botName} wants to change ${file}`, source: `From: the chat · ${time}. ${botName} keeps working on other things while this waits.`, lines: lines.map((line) => ({ ...line, text: LINE_PREFIXES[line.kind] + line.text })) };
}
