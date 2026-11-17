import { opensOutside } from "@botsman/client-core";
import { useCopied } from "@botsman/client-core/react";
import { type AnchorHTMLAttributes, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useOpenLink } from "../open-link.tsx";
import remarkGfm from "remark-gfm";

// A reply's text drawn as Markdown, with tables, a Copy button on each code block, and links that open outside the
// app. It redraws only when its text changes, so a streaming reply doesn't redraw the replies before it.
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, a: Link }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

// A web or mail link opens in the browser or mail app. Any other link does nothing. The link has no address of its
// own, so no click, middle-click, or menu can take the app's window away; hovering shows where it goes.
function Link({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const openLink = useOpenLink();
  const open = () => {
    if (href !== undefined && opensOutside(href)) openLink(href);
  };
  return (
    <a role="link" tabIndex={0} title={href} className="cursor-pointer" onClick={open} onKeyDown={(event) => event.key === "Enter" && open()}>
      {children}
    </a>
  );
}

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
