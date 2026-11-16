import { type ChatController, exactCommand, modelChipLabel, runCommand, type SendMode, type SlashCommand, type SlashScreen, slashMatches } from "@botsman/client-core";
import { useAction, useModels } from "@botsman/client-core/react";
import type { Bot, ChatSettings } from "@botsman/protocol";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import Svg, { Path } from "react-native-svg";
import { Button } from "../ui/button";
import { ModelSheet } from "../ui/model-sheet";

// Where the owner writes. Below the text: a commands button, the model chip that opens the model picker, and Send, or
// Queue, Steer, and Stop while the bot works. A message starting with / offers commands.
export function Composer({ chat, bot, settings, sendModes, busy }: { chat: ChatController; bot: Bot; settings: ChatSettings; sendModes: SendMode[]; busy: boolean }) {
  const { colors } = useTheme();
  const { models } = useModels();
  const [picking, setPicking] = useState(false);
  // The box grows with the text up to 40% of the screen, then scrolls.
  const maxHeight = useWindowDimensions().height * 0.4;
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());
  const command = useAction(async (picked: SlashCommand) => {
    setText("");
    const action = await runCommand(picked, chat);
    if (action.kind === "open") openScreen(action.screen, chat.botId);
  });
  const matches = slashMatches(text);
  const empty = text.trim() === "";

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
        placeholder={busy ? "Queue a message" : `Message ${bot.name}`}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={`Message ${bot.name}`}
        style={[styles.input, { color: colors.foreground, maxHeight }]}
      />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Commands" onPress={() => setText(text === "" ? "/" : text)} hitSlop={6} style={styles.slash}>
          <Text style={[styles.command, { color: colors.mutedForeground }]}>/</Text>
        </Pressable>
        <View style={styles.grow} />
        <Pressable accessibilityRole="button" accessibilityLabel="Model and reasoning" onPress={() => setPicking(true)} style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Text numberOfLines={1} style={[styles.chipText, { color: colors.foreground }]}>
            {modelChipLabel(settings, models)}
          </Text>
        </Pressable>
        {busy ? (
          <>
            {sendModes.includes("queue") ? <Button label="Queue" variant="text" disabled={empty} onPress={() => send("queue")} /> : null}
            {sendModes.includes("steer") ? <Button label="Steer" disabled={empty} onPress={() => send("steer")} /> : null}
            <Button label="■ Stop" disabled={stop.busy} onPress={() => void stop.run()} />
          </>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={empty} onPress={() => send("send")} style={[styles.send, { backgroundColor: colors.primary, opacity: empty ? 0.4 : 1 }]}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={colors.primaryForeground} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 19V5M5 12l7-7 7 7" />
            </Svg>
          </Pressable>
        )}
      </View>
      <ModelSheet visible={picking} bot={bot} chat={{ controller: chat, settings }} onClose={() => setPicking(false)} />
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
  input: { fontFamily: fontFamilies.body, fontSize: 16, paddingHorizontal: space[2], paddingVertical: space[1] },
  actions: { flexDirection: "row", alignItems: "center", gap: space[2] },
  grow: { flex: 1 },
  slash: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  chip: { borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], flexShrink: 1 },
  chipText: { fontFamily: fontFamilies.bodySemiBold, fontSize: 12 },
  send: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
});
