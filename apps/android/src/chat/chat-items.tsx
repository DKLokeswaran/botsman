import { type ChatController, type ChatItem, formatMessageTime, formatUsage, type RunItem, type RunStep, showsWorking, type ToolLine, workLabel } from "@botsman/client-core";

type WorkStep = Extract<RunStep, { kind: "work" }>;
import { useAction } from "@botsman/client-core/react";
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
  if (item.kind === "user") return <OwnerMessage text={item.text} note={timeLabel(item.at)} />;
  if (item.kind === "run") return <Run item={item} botName={botName} />;
  if (item.kind === "queued") return <OwnerMessage text={item.text} note={item.mode === "steer" ? "Steering the reply" : "Queued"} muted />;
  if (item.kind === "pending") return <PendingMessage item={item} chat={chat} />;
  if (item.kind === "failure") return <Failure text={item.text} chat={chat} />;
  return <Text style={[styles.notice, { color: colors.mutedForeground }]}>{item.text}</Text>;
}

// A message's time, for the small line beside it. Entries without a time show none.
function timeLabel(at: number | null): string | undefined {
  return at === null ? undefined : formatMessageTime(at, Date.now());
}

function OwnerMessage({ text, note, muted = false }: { text: string; note?: string | undefined; muted?: boolean }) {
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

// A reply that failed, with a way to ask the model again.
function Failure({ text, chat }: { text: string; chat: ChatController }) {
  const { colors } = useTheme();
  const retry = useAction(() => chat.retryReply());
  return (
    <View style={[styles.failure, { borderColor: colors.destructive }]}>
      <Text style={[styles.failureText, { color: colors.destructive }]}>{text}</Text>
      {retry.error === undefined ? null : <Text style={[styles.small, { color: colors.destructive }]}>{retry.error}</Text>}
      <View style={styles.row}>
        <Button label="Retry" variant="text" disabled={retry.busy} onPress={() => void retry.run()} />
      </View>
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

// One run: the bot's replies in order, with the thinking and tool calls between them folded away, and the run's
// total cost at the end. An approval stays in view, outside its fold.
function Run({ item, botName }: { item: RunItem; botName: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.reply}>
      <View style={styles.nameLine}>
        <Text style={[styles.name, { color: colors.foreground }]}>{botName.toUpperCase()}</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{timeLabel(item.at)}</Text>
      </View>
      {item.steps.map((step, index) =>
        step.kind === "text" ? (
          <Markdown key={step.id} text={step.text} streaming={item.working && index === item.steps.length - 1} />
        ) : (
          <WorkFold key={step.id} step={step} live={item.working && index === item.steps.length - 1} />
        ),
      )}
      {showsWorking(item) ? <Text style={[styles.body, { color: colors.mutedForeground }]}>Working…</Text> : null}
      {item.error === null ? null : <Text style={[styles.body, { color: colors.destructive }]}>{item.error}</Text>}
      {item.usage === null || item.working ? null : <Text style={[styles.small, { color: colors.mutedForeground }]}>{formatUsage(item.usage)}</Text>}
    </View>
  );
}

// Thinking and tool calls between two replies, folded into one line.
function WorkFold({ step, live }: { step: WorkStep; live: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.tool}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} hitSlop={8}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {open ? "▾ " : "▸ "}
          {workLabel(step, live)}
        </Text>
      </Pressable>
      {open ? (
        <View style={[styles.fold, { borderColor: colors.border }]}>
          {step.thinking === "" ? null : (
            <Text selectable style={[styles.thinkingText, { color: colors.mutedForeground }]}>
              {step.thinking}
            </Text>
          )}
          {step.tools.map((tool) => (
            <ToolLineView key={tool.callId} tool={tool} />
          ))}
        </View>
      ) : null}
      {step.tools.flatMap((tool) => (tool.approvalId === undefined ? [] : [<ApprovalCard key={tool.approvalId} approvalId={tool.approvalId} />]))}
    </View>
  );
}

const TOOL_VERBS: Record<ToolLine["status"], string> = { waiting: "Waiting", running: "Running", done: "Ran", failed: "Failed" };

// One tool call: a line that opens to its output, and the approval card while it waits for the owner.
function ToolLineView({ tool }: { tool: ToolLine }) {
  return (
    <View style={styles.tool}>
      <Foldout label={`${TOOL_VERBS[tool.status]}: ${tool.summary}`} body={tool.output} startOpen={false} failed={tool.status === "failed"} mono />
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
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: space[2] },
  name: { fontFamily: fontFamilies.display, fontSize: 13 },
  body: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fontFamilies.body, fontSize: 12 },
  notice: { fontFamily: fontFamilies.body, fontSize: 12, textAlign: "center" },
  failure: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
  failureText: { fontFamily: fontFamilies.body, fontSize: 14 },
  fold: { borderLeftWidth: 1, paddingLeft: space[3], gap: space[2] },
  thinkingText: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  thinking: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, borderLeftWidth: 1, paddingLeft: space[3], marginTop: space[1] },
  output: { fontFamily: fontFamilies.mono, fontSize: 12, borderWidth: 1, borderRadius: radius.md, padding: space[3], marginTop: space[1] },
});
