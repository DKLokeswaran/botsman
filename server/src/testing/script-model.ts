import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, type Message } from "@earendil-works/pi-ai";

export const SCRIPT_PROVIDER = "script";
export const SCRIPT_MODEL = "script-1";

// A scripted model for tests, built on pi-ai's faux provider, so no test spends money on a real model.
// The owner's last message decides the reply:
//   "tool <name> <json args>"  calls that tool, then reports its result
//   "slow <n>"                 streams n words slowly, for stop and steer tests
//   anything else              answers "echo: <message>", cut to 200 characters
export function scriptModelProvider(options: { provider?: string; contextWindow?: number } = {}) {
  const faux = fauxProvider({
    provider: options.provider ?? SCRIPT_PROVIDER,
    models: [{ id: SCRIPT_MODEL, contextWindow: options.contextWindow ?? 200_000, maxTokens: 8_000 }],
    tokensPerSecond: 400,
  });
  const respond = (context: { messages: readonly Message[] }) => reply(context.messages);
  const step = (context: { messages: Message[] }) => {
    faux.appendResponses([step]);
    return respond(context);
  };
  faux.setResponses([step]);
  return faux;
}

function reply(messages: readonly Message[]) {
  const last = messages[messages.length - 1];
  if (last?.role === "toolResult") return fauxAssistantMessage(fauxText(`tool ${last.toolName} returned: ${textOf(last).slice(0, 2000)}`));
  const text = lastLine(textOf(last));
  const tool = /^tool (\S+) (\{.*\})$/s.exec(text);
  if (tool) return fauxAssistantMessage([fauxToolCall(tool[1]!, JSON.parse(tool[2]!))], { stopReason: "toolUse" });
  const slow = /^slow (\d+)$/.exec(text);
  if (slow) return fauxAssistantMessage(fauxText(Array.from({ length: Number(slow[1]) }, (_, index) => `word${index}`).join(" ")));
  return fauxAssistantMessage(fauxText(`echo: ${text.slice(0, 200)}`));
}

function textOf(message: Message | undefined): string {
  if (message === undefined || !("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
}

// The owner's own words come last, after any memory update or notice the server added.
function lastLine(text: string): string {
  const parts = text.split("\n\n");
  return parts[parts.length - 1]!.trim();
}
