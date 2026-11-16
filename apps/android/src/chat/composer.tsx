import type { ChatController, SendMode } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "../ui/button";

const SEND_LABELS: Record<SendMode, string> = { send: "Send", queue: "Queue", steer: "Steer" };

// Where the owner writes. While the bot is busy it offers Queue and Steer, and a Stop button.
export function Composer({ chat, botName, sendModes, busy }: { chat: ChatController; botName: string; sendModes: SendMode[]; busy: boolean }) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());

  const send = (mode: SendMode) => {
    const message = text.trim();
    if (message === "") return;
    setText("");
    void chat.send(message, mode);
  };

  return (
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

const styles = StyleSheet.create({
  composer: { borderWidth: 1, borderRadius: radius.lg, padding: space[2], gap: space[2] },
  input: { fontFamily: fontFamilies.body, fontSize: 16, maxHeight: 160, paddingHorizontal: space[2], paddingVertical: space[1] },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
});
