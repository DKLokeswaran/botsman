import { type ChatController, exactCommand, runCommand, type SendMode, type SlashCommand, type SlashScreen, slashMatches } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "../ui/button";

const SEND_LABELS: Record<SendMode, string> = { send: "Send", queue: "Queue", steer: "Steer" };

// Where the owner writes. While the bot is busy it offers Queue and Steer, and a Stop button. A message starting
// with / offers commands.
export function Composer({ chat, botName, sendModes, busy }: { chat: ChatController; botName: string; sendModes: SendMode[]; busy: boolean }) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());
  const command = useAction(async (picked: SlashCommand) => {
    setText("");
    const action = await runCommand(picked, chat);
    if (action.kind === "help") setText("/");
    if (action.kind === "open") openScreen(action.screen, chat.botId);
  });
  const matches = slashMatches(text);

  const send = (mode: SendMode) => {
    const message = text.trim();
    if (message === "") return;
    const named = exactCommand(message);
    if (named !== undefined) return void command.run(named);
    setText("");
    void chat.send(message, mode);
  };

  return (
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {matches === undefined ? null : <SlashMenu matches={matches} onPick={(picked) => void command.run(picked)} />}
      {command.error === undefined ? null : <Text style={[styles.hint, { color: colors.destructive }]}>{command.error}</Text>}
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={`Message ${botName}`}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={`Message ${botName}`}
        style={[styles.input, { color: colors.foreground }]}
      />
      <View style={styles.actions}>
        {busy ? <Button label="Stop" variant="danger" disabled={stop.busy} onPress={() => void stop.run()} /> : null}
        {sendModes.map((mode, index) => (
          <Button key={mode} label={SEND_LABELS[mode]} variant={index === 0 ? "primary" : "ghost"} disabled={text.trim() === ""} onPress={() => send(mode)} />
        ))}
      </View>
    </View>
  );
}

function SlashMenu({ matches, onPick }: { matches: SlashCommand[]; onPick: (command: SlashCommand) => void }) {
  const { colors } = useTheme();
  if (matches.length === 0) return <Text style={[styles.hint, { color: colors.mutedForeground }]}>No matching command</Text>;
  return (
    <View accessibilityLabel="Commands" style={[styles.menu, { borderBottomColor: colors.border }]}>
      {matches.map((match) => (
        <Pressable key={match.name} accessibilityRole="button" onPress={() => onPick(match)} android_ripple={{ color: colors.accent }} style={styles.option}>
          <Text style={[styles.command, { color: colors.foreground }]}>/{match.name}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{match.hint}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function openScreen(screen: SlashScreen, botId: string): void {
  if (screen === "memory") return router.push({ pathname: "/memory/[botId]", params: { botId } });
  if (screen === "notes") return router.push({ pathname: "/notes/[botId]", params: { botId } });
  router.push("/usage");
}

const styles = StyleSheet.create({
  menu: { borderBottomWidth: 1, paddingBottom: space[2] },
  option: { paddingHorizontal: space[2], paddingVertical: space[2], gap: 2 },
  command: { fontFamily: fontFamilies.mono, fontSize: 14 },
  hint: { fontFamily: fontFamilies.body, fontSize: 13, paddingHorizontal: space[2] },
  composer: { borderWidth: 1, borderRadius: radius.lg, padding: space[2], gap: space[2] },
  input: { fontFamily: fontFamilies.body, fontSize: 16, maxHeight: 160, paddingHorizontal: space[2], paddingVertical: space[1] },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
});
