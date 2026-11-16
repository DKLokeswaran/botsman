import { formatCountdown } from "@botsman/client-core";
import { useAction, useApproval, useBotsmanClient, useNow } from "@botsman/client-core/react";
import type { Approval } from "@botsman/protocol";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "../ui/button";

// A tool call waiting for the owner: why the bot asks, the full command, the time left, and the answers.
export function ApprovalCard({ approvalId }: { approvalId: string }) {
  const { colors } = useTheme();
  const approval = useApproval(approvalId);
  if (approval === undefined) return <Text style={[styles.body, { color: colors.mutedForeground }]}>Waiting for your approval…</Text>;
  return <ApprovalDetails approval={approval} />;
}

function ApprovalDetails({ approval }: { approval: Approval }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const now = useNow();
  const answer = useAction((decision: "allow_once" | "allow_chat" | "deny") => client.answerApproval(approval.id, decision));
  // A memory edit is allowed one at a time, so it has no "for this chat" answer.
  const isMemoryEdit = approval.memoryEdit !== null;
  return (
    <View accessibilityLabel="Approval" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>{(isMemoryEdit ? `Edit ${approval.memoryEdit!.file}` : "Needs your approval").toUpperCase()}</Text>
        <Text style={[styles.mono, { color: colors.mutedForeground }]}>{formatCountdown(approval.expiresAt, now)}</Text>
      </View>
      <Text style={[styles.body, { color: colors.foreground }]}>{approval.description}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{approval.reason}</Text>
      <ScrollView style={[styles.command, { backgroundColor: colors.background, borderColor: colors.border }]} nestedScrollEnabled>
        <Text selectable style={[styles.mono, { color: colors.green }]}>
          {isMemoryEdit ? approval.memoryEdit!.content : approval.command}
        </Text>
      </ScrollView>
      {answer.error === undefined ? null : <Text style={[styles.body, { color: colors.destructive }]}>{answer.error}</Text>}
      <View style={styles.answers}>
        <Button label={isMemoryEdit ? "Allow" : "Allow once"} variant="primary" disabled={answer.busy} onPress={() => void answer.run("allow_once")} />
        {isMemoryEdit ? null : <Button label="Allow for this chat" disabled={answer.busy} onPress={() => void answer.run("allow_chat")} />}
        <Button label="Deny" variant="danger" disabled={answer.busy} onPress={() => void answer.run("deny")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[4] },
  title: { fontFamily: fontFamilies.display, fontSize: 13, flexShrink: 1 },
  body: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  mono: { fontFamily: fontFamilies.mono, fontSize: 12 },
  command: { borderWidth: 1, borderRadius: radius.md, padding: space[3], maxHeight: 220 },
  answers: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
