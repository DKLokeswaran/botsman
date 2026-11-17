import { Markdown } from "./markdown.tsx";

// A memory file or note as it reads, before the owner chooses to edit it.
export function ReadOnlyText({ text }: { text: string }) {
  if (text.trim() === "") return <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">Empty</p>;
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border px-3 py-2">
      <Markdown text={text} />
    </div>
  );
}
