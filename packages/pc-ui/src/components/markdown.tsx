import { type ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// A reply's text drawn as Markdown, with tables and a Copy button on each code block.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async (button: HTMLButtonElement) => {
    await navigator.clipboard.writeText(button.parentElement?.querySelector("code")?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <button type="button" onClick={(event) => void copy(event.currentTarget)} className="absolute right-2 top-2 rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}
