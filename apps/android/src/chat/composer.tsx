import { type ChatController, modelChipLabel, type SendMode, type SlashCommand, type SlashScreen, type Bot, type ChatSettings } from "@botsman/client-core";
import { useComposer, useModels } from "@botsman/client-core/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { ICONS } from "@botsman/tokens";
import Svg, { Path } from "react-native-svg";
import { MarkIcon } from "../ui/avatar";
import { Button } from "../ui/button";
import { ModelSheet } from "../ui/model-sheet";

// Where the owner writes. A message starting with / offers commands. Below the text: the attach and image buttons, the
// model chip that opens the model picker, and Send, or Queue, Steer, and Stop while the bot works.
export function Composer({ chat, bot, settings, sendModes, busy }: { chat: ChatController; bot: Bot; settings: ChatSettings; sendModes: SendMode[]; busy: boolean }) {
  const { colors } = useTheme();
  const { models } = useModels();
  const [picking, setPicking] = useState(false);
  // The box grows with the text up to 40% of the screen, then scrolls.
  const maxHeight = useWindowDimensions().height * 0.4;
  const { text, setText, label, placeholder, matches, empty, send, command, stop } = useComposer(chat, bot.name, busy, openScreen);

  return (
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {matches === undefined ? null : <SlashMenu matches={matches} onPick={(picked) => void command.run(picked)} />}
      {command.error === undefined ? null : <Text style={[styles.hint, { color: colors.destructive }]}>{command.error}</Text>}
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={label}
        style={[styles.input, { color: colors.foreground, maxHeight }]}
      />
      <View style={styles.actions}>
        <ComingSoon label="Attach a file" paths={ICONS.attach} />
        <ComingSoon label="Add an image" paths={ICONS.image} />
        <View style={styles.grow} />
        <Pressable accessibilityRole="button" accessibilityLabel="Model and reasoning" onPress={() => setPicking(true)} style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Text numberOfLines={1} style={[styles.chipText, { color: colors.foreground }]}>
            {modelChipLabel(settings, models)}
          </Text>
        </Pressable>
        {busy ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={empty} onPress={() => send("send")} style={[styles.send, { backgroundColor: colors.primary, opacity: empty ? 0.4 : 1 }]}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={colors.primaryForeground} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 19V5M5 12l7-7 7 7" />
            </Svg>
          </Pressable>
        )}
      </View>
      {busy ? (
        // While the bot works, its buttons get their own row, so they never crowd the model chip on a phone.
        <View style={styles.busyRow}>
          {sendModes.includes("queue") ? <Button label="Queue" variant="text" disabled={empty} onPress={() => send("queue")} /> : null}
          {sendModes.includes("steer") ? <Button label="Steer" disabled={empty} onPress={() => send("steer")} /> : null}
          <Button label="■ Stop" variant="danger" disabled={stop.busy} onPress={() => void stop.run()} />
        </View>
      ) : null}
      <ModelSheet visible={picking} bot={bot} chat={{ controller: chat, settings }} onClose={() => setPicking(false)} />
    </View>
  );
}

// A toolbar button for a feature that hasn't arrived yet: shown, but disabled.
function ComingSoon({ label, paths }: { label: string; paths: readonly string[] }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="button" accessibilityLabel={`${label}, coming in a later update`} accessibilityState={{ disabled: true }} style={[styles.toolButton, styles.disabled]}>
      <MarkIcon paths={paths} size={18} color={colors.mutedForeground} />
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
  toolButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
  busyRow: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
  chip: { borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], flexShrink: 1, minWidth: 0 },
  chipText: { fontFamily: fontFamilies.bodySemiBold, fontSize: 12 },
  send: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
});
