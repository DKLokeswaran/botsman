import { type ChatController, type ChatItem, formatUsage, type ToolLine } from "@botsman/client-core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "../ui/button";
import { ApprovalCard } from "./approval-card";
import { Markdown } from "./markdown";

type ItemOf<Kind extends ChatItem["kind"]> = Extract<ChatItem, { kind: Kind }>;

// Draws one item of a chat.
export function ChatItemView({ item, chat, botName }: { item: ChatItem; chat: ChatController; botName: string }) {
  const { colors } = useTheme();
  if (item.kind === "user") return <OwnerMessage text={item.text} />;
  if (item.kind === "reply") return <Reply item={item} botName={botName} />;
  if (item.kind === "queued") return <OwnerMessage text={item.text} note={item.mode === "steer" ? "Steering the reply" : "Queued"} muted />;
  if (item.kind === "pending") return <PendingMessage item={item} chat={chat} />;
  if (item.kind === "failure") return <Text style={[styles.failure, { color: colors.destructive, borderColor: colors.destructive }]}>{item.text}</Text>;
  return <Text style={[styles.notice, { color: colors.mutedForeground }]}>{item.text}</Text>;
}

function OwnerMessage({ text, note, muted = false }: { text: string; note?: string; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.owner}>
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, opacity: muted ? 0.6 : 1 }]}>
        <Text selectable style={[styles.body, { color: colors.foreground }]}>
          {text}
        </Text>
      </View>
      {note === undefined ? null : <Text style={[styles.small, { color: colors.mutedForeground }]}>{note}</Text>}
    </View>
  );
}

function PendingMessage({ item, chat }: { item: ItemOf<"pending">; chat: ChatController }) {
  const { colors } = useTheme();
  if (item.failed === undefined) return <OwnerMessage text={item.text} note="Sending…" muted />;
  return (
    <View style={styles.owner}>
      <OwnerMessage text={item.text} muted />
      <Text style={[styles.small, { color: colors.destructive }]}>{item.failed}</Text>
      <View style={styles.row}>
        <Button label="Retry" variant="text" onPress={() => void chat.retry(item.id)} />
        <Button label="Discard" variant="text" onPress={() => chat.discard(item.id)} />
      </View>
    </View>
  );
}

function Reply({ item, botName }: { item: ItemOf<"reply">; botName: string }) {
  const { colors } = useTheme();
  const idle = item.streaming && item.text === "" && item.thinking === "" && item.tools.length === 0;
  return (
    <View style={styles.reply}>
      <Text style={[styles.name, { color: colors.foreground }]}>{botName.toUpperCase()}</Text>
      {item.thinking === "" ? null : <Foldout label={item.streaming && item.text === "" ? "Thinking" : "Thought"} body={item.thinking} startOpen={item.streaming && item.text === ""} />}
      {item.tools.map((tool) => (
        <ToolLineView key={tool.callId} tool={tool} />
      ))}
      {item.text === "" ? null : <Markdown text={item.text} streaming={item.streaming} />}
      {idle ? <Text style={[styles.body, { color: colors.mutedForeground }]}>Working…</Text> : null}
      {item.error === null ? null : <Text style={[styles.body, { color: colors.destructive }]}>{item.error}</Text>}
      {item.usage === null ? null : <Text style={[styles.small, { color: colors.mutedForeground }]}>{formatUsage(item.usage)}</Text>}
    </View>
  );
}

const TOOL_VERBS: Record<ToolLine["status"], string> = { waiting: "Waiting", running: "Running", done: "Ran", failed: "Failed" };

// One tool call: a line that opens to its output, and the approval card while it waits for the owner.
function ToolLineView({ tool }: { tool: ToolLine }) {
  return (
    <View style={styles.tool}>
      <Foldout label={`${TOOL_VERBS[tool.status]}: ${tool.summary}`} body={tool.output} startOpen={false} failed={tool.status === "failed"} mono />
      {tool.approvalId === undefined ? null : <ApprovalCard approvalId={tool.approvalId} />}
    </View>
  );
}

// A line that opens and closes on a tap, for thinking and tool output.
function Foldout({ label, body, startOpen, failed = false, mono = false }: { label: string; body: string; startOpen: boolean; failed?: boolean; mono?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(startOpen);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} hitSlop={8}>
        <Text style={[styles.body, { color: failed ? colors.destructive : colors.mutedForeground }]}>
          {open ? "▾ " : "▸ "}
          {label}
        </Text>
      </Pressable>
      {open && body !== "" ? (
        <Text selectable style={[mono ? styles.output : styles.thinking, { color: colors.mutedForeground, borderColor: colors.border, backgroundColor: mono ? colors.card : "transparent" }]}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  owner: { alignItems: "flex-end", gap: space[1] },
  bubble: { maxWidth: "88%", borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space[4], paddingVertical: space[3] },
  reply: { gap: space[2] },
  tool: { gap: space[2] },
  row: { flexDirection: "row", gap: space[2] },
  name: { fontFamily: fontFamilies.display, fontSize: 13 },
  body: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fontFamilies.body, fontSize: 12 },
  notice: { fontFamily: fontFamilies.body, fontSize: 12, textAlign: "center" },
  failure: { fontFamily: fontFamilies.body, fontSize: 14, borderWidth: 1, borderRadius: radius.md, padding: space[3] },
  thinking: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, borderLeftWidth: 1, paddingLeft: space[3], marginTop: space[1] },
  output: { fontFamily: fontFamilies.mono, fontSize: 12, borderWidth: 1, borderRadius: radius.md, padding: space[3], marginTop: space[1] },
});
