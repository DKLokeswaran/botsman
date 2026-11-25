import { approvalWaitLabel } from "@botsman/client-core";
import { useBotSettings } from "@botsman/client-core/react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../../src/theme";
import { ErrorText, Note, Page, pageStyles, SectionTitle, Segmented, ToggleRow } from "../../src/ui/page";

// How much a bot may do without asking: its permission mode, how long approvals wait, and network access.
export default function BotSettingsScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { bot, modes, modeNote, waits, change, error } = useBotSettings(botId);
  if (bot === undefined) return <Page title="Bot settings"><Note>This bot no longer exists.</Note></Page>;
  return (
    <Page title={bot.name} subtitle="Bot settings">
      <SectionTitle>Permissions</SectionTitle>
      <Segmented label="Permission mode" options={modes} value={bot.permissionMode} onChange={(permissionMode) => change({ permissionMode })} />
      <Note>{modeNote}</Note>
      <ApprovalWait ms={bot.approvalWaitMs} waits={waits} onChange={(approvalWaitMs) => change({ approvalWaitMs })} />
      <ToggleRow title="Network" detail="Commands run by this bot can reach the internet" on={bot.network} onChange={(network) => change({ network })} />
      <ErrorText>{error}</ErrorText>
    </Page>
  );
}

function ApprovalWait({ ms, waits, onChange }: { ms: number; waits: ReturnType<typeof useBotSettings>["waits"]; onChange: (ms: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{`Approval wait · ${approvalWaitLabel(ms)}`}</Text>
      <View style={styles.chips}>
        {waits.map((wait) => (
          <Pressable key={wait.ms} accessibilityRole="radio" accessibilityState={{ checked: wait.chosen }} onPress={() => onChange(wait.ms)} style={[pageStyles.row, { borderColor: wait.chosen ? colors.primary : colors.border }]}>
            <Text style={[pageStyles.small, { color: wait.chosen ? colors.primary : colors.foreground }]}>{wait.label}</Text>
          </Pressable>
        ))}
      </View>
      <Note>If you don't answer in time, the action is refused and the bot is told.</Note>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
