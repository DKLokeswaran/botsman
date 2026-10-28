import { useEffect, useLayoutEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);

function highlighted(code: string, language: string): string {
  const name = language.toLowerCase();
  if (hljs.getLanguage(name)) {
    return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
  }
  return hljs.highlightAuto(code).value;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function CodeFence({ language, text }: { language: string; text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const html = highlighted(text, language);
  return (
    <div className="fence">
      <div className="fence-bar">
        <span>{language}</span>
        <button
          type="button"
          onClick={() => {
            void copyText(text).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

export function Reply({ text }: { text: string }) {
  return (
    <div className="reply">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            const raw = String(children).replace(/\n$/, "");
            const language = /language-([\w#+.-]+)/.exec(className ?? "")?.[1];
            if (!language && !raw.includes("\n")) {
              return <code>{children}</code>;
            }
            return <CodeFence language={language || "text"} text={raw} />;
          },
        }}
      >
        {text || "…"}
      </ReactMarkdown>
    </div>
  );
}

export function UserLine({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [node, setNode] = useState<HTMLParagraphElement | null>(null);
  useLayoutEffect(() => {
    setExpanded(false);
  }, [text]);
  useLayoutEffect(() => {
    if (!node || expanded) {
      return;
    }
    setClamped(node.scrollHeight > node.clientHeight + 1);
  }, [node, text, expanded]);
  return (
    <>
      <p ref={setNode} className={expanded ? "user-text" : "user-text line-clamp-6"}>
        {text}
      </p>
      {clamped || expanded ? (
        <button type="button" className="more" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}
