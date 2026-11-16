import { useCopied } from "@botsman/client-core/react";
import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// A reply's text drawn as Markdown, with tables and a Copy button on each code block. It redraws only when its text
// changes, so a streaming reply doesn't redraw the replies before it.
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ children }: { children?: ReactNode }) {
  const { copied, copy } = useCopied((text) => navigator.clipboard.writeText(text));
  return (
    <div className="relative">
      <button type="button" onClick={(event) => void copy(event.currentTarget.parentElement?.querySelector("code")?.textContent ?? "")} className="absolute right-2 top-2 rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}
