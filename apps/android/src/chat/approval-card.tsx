import { formatCountdown, memoryDiff, memoryEditText, type Approval } from "@botsman/client-core";
import { useAction, useApproval, useBot, useBotsmanClient, useNow } from "@botsman/client-core/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "../ui/button";

// A tool call waiting for the owner: why the bot asks, the full command, the time left, and the answers.
export function ApprovalCard({ approvalId }: { approvalId: string }) {
  const { colors } = useTheme();
  const approval = useApproval(approvalId);
  if (approval === undefined) return <Text style={[styles.body, { color: colors.mutedForeground }]}>Waiting for your approval…</Text>;
  return approval.memoryEdit === null ? <ApprovalDetails approval={approval} /> : <MemoryEditCard approval={approval} />;
}

// A bot asking to change one of its memory files: what it adds and removes, and Confirm or Reject.
function MemoryEditCard({ approval }: { approval: Approval }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const now = useNow();
  const bot = useBot(approval.botId);
  const answer = useAction((decision: "allow_once" | "deny") => client.answerApproval(approval.id, decision));
  const edit = approval.memoryEdit!;
  const text = memoryEditText(approval, bot?.name ?? "The bot");
  const lines = memoryDiff(edit.previous, edit.content);
  const lineColor = { added: colors.green, removed: colors.destructive, same: colors.mutedForeground };
  return (
    <View accessibilityLabel="Memory edit" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.primary }]}>Needs you · Memory edit</Text>
        <Text style={[styles.mono, { color: colors.mutedForeground }]}>{formatCountdown(approval.expiresAt, now)}</Text>
      </View>
      <Text style={[styles.heading, { color: colors.foreground }]}>{text.title}</Text>
      <ScrollView style={[styles.command, { backgroundColor: colors.background, borderColor: colors.border }]} nestedScrollEnabled>
        {lines.length === 0 ? <Text style={[styles.mono, { color: colors.mutedForeground }]}>No change</Text> : null}
        {lines.map((line, index) => (
          <Text key={index} selectable style={[styles.mono, { color: lineColor[line.kind] }]}>
            {line.kind === "added" ? "+ " : line.kind === "removed" ? "− " : "  "}
            {line.text}
          </Text>
        ))}
      </ScrollView>
      <Text style={[styles.small, { color: colors.mutedForeground }]}>{text.source}</Text>
      {answer.error === undefined ? null : <Text style={[styles.body, { color: colors.destructive }]}>{answer.error}</Text>}
      <View style={styles.answers}>
        <Button label="Confirm" variant="primary" disabled={answer.busy} onPress={() => void answer.run("allow_once")} />
        <Button label="Reject" disabled={answer.busy} onPress={() => void answer.run("deny")} />
      </View>
    </View>
  );
}

function ApprovalDetails({ approval }: { approval: Approval }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const now = useNow();
  const answer = useAction((decision: "allow_once" | "allow_chat" | "deny") => client.answerApproval(approval.id, decision));
  return (
    <View accessibilityLabel="Approval" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>NEEDS YOUR APPROVAL</Text>
        <Text style={[styles.mono, { color: colors.mutedForeground }]}>{formatCountdown(approval.expiresAt, now)}</Text>
      </View>
      <Text style={[styles.body, { color: colors.foreground }]}>{approval.description}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{approval.reason}</Text>
      <ScrollView style={[styles.command, { backgroundColor: colors.background, borderColor: colors.border }]} nestedScrollEnabled>
        <Text selectable style={[styles.mono, { color: colors.green }]}>
          {approval.command}
        </Text>
      </ScrollView>
      {answer.error === undefined ? null : <Text style={[styles.body, { color: colors.destructive }]}>{answer.error}</Text>}
      <View style={styles.answers}>
        <Button label="Allow once" variant="primary" disabled={answer.busy} onPress={() => void answer.run("allow_once")} />
        <Button label="Allow for this chat" disabled={answer.busy} onPress={() => void answer.run("allow_chat")} />
        <Button label="Deny" variant="danger" disabled={answer.busy} onPress={() => void answer.run("deny")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[4] },
  kicker: { fontFamily: fontFamilies.bodySemiBold, fontSize: 12 },
  heading: { fontFamily: fontFamilies.bodySemiBold, fontSize: 16 },
  small: { fontFamily: fontFamilies.body, fontSize: 12 },
  title: { fontFamily: fontFamilies.display, fontSize: 13, flexShrink: 1 },
  body: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  mono: { fontFamily: fontFamilies.mono, fontSize: 12 },
  command: { borderWidth: 1, borderRadius: radius.md, padding: space[3], maxHeight: 220 },
  answers: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
