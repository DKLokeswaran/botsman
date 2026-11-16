import { APPROVAL_WAITS, approvalWaitLabel, PERMISSION_MODES } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient } from "@botsman/client-core/react";
import type { Bot, BotUpdate } from "@botsman/protocol";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../../src/theme";
import { ErrorText, Note, Page, pageStyles, SectionTitle, Segmented, ToggleRow } from "../../src/ui/page";

// How much a bot may do without asking: its permission mode, how long approvals wait, and network access.
export default function BotSettingsScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  const client = useBotsmanClient();
  const save = useAction((change: BotUpdate) => client.updateBot(botId, change));
  if (bot === undefined) return <Page title="Bot settings"><Note>This bot no longer exists.</Note></Page>;
  const mode = PERMISSION_MODES.find((option) => option.mode === bot.permissionMode)!;
  return (
    <Page title={bot.name} subtitle="Bot settings">
      <SectionTitle>Permissions</SectionTitle>
      <Segmented label="Permission mode" options={PERMISSION_MODES.map((option) => ({ value: option.mode, label: option.label }))} value={bot.permissionMode} onChange={(permissionMode) => void save.run({ permissionMode })} />
      <Note>{`${mode.note} Memory edits always ask, in every mode.`}</Note>
      <ApprovalWait bot={bot} onChange={(approvalWaitMs) => void save.run({ approvalWaitMs })} />
      <ToggleRow title="Network" detail="Commands run by this bot can reach the internet" on={bot.network} onChange={(network) => void save.run({ network })} />
      <ErrorText>{save.error}</ErrorText>
    </Page>
  );
}

function ApprovalWait({ bot, onChange }: { bot: Bot; onChange: (ms: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{`Approval wait · ${approvalWaitLabel(bot.approvalWaitMs)}`}</Text>
      <View style={styles.chips}>
        {APPROVAL_WAITS.map((wait) => {
          const chosen = wait.ms === bot.approvalWaitMs;
          return (
            <Pressable key={wait.ms} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => onChange(wait.ms)} style={[pageStyles.row, { borderColor: chosen ? colors.primary : colors.border }]}>
              <Text style={[pageStyles.small, { color: chosen ? colors.primary : colors.foreground }]}>{wait.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Note>If you don't answer in time, the action is refused and the bot is told.</Note>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
