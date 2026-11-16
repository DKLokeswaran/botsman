import type { Bot } from "@botsman/protocol";
import { Image, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, useTheme } from "../theme";

// A bot's picture: its uploaded photo, or a square with its initial.
export function Avatar({ bot, size = 40 }: { bot: Pick<Bot, "name" | "avatar">; size?: number }) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderColor: colors.border };
  if (bot.avatar?.kind === "photo") return <Image source={{ uri: bot.avatar.dataUrl }} style={[styles.box, box]} />;
  return (
    <View style={[styles.box, box, { backgroundColor: colors.card }]}>
      <Text style={[styles.initial, { color: colors.foreground }]}>{bot.name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fontFamilies.display, fontSize: 14 },
});
