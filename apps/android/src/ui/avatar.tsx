import type { Bot } from "@botsman/client-core";
import { MARK_STROKE, MARKS } from "@botsman/tokens";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fontFamilies, radius, useTheme } from "../theme";

// A bot's picture: its uploaded photo, its chosen mark, or a square with its initial.
export function Avatar({ bot, size = 40 }: { bot: Pick<Bot, "name" | "avatar">; size?: number }) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderColor: colors.border };
  if (bot.avatar?.kind === "photo") return <Image source={{ uri: bot.avatar.dataUrl }} style={[styles.box, box]} />;
  const mark = bot.avatar?.kind === "mark" ? MARKS[bot.avatar.mark] : undefined;
  return (
    <View style={[styles.box, box, { backgroundColor: colors.card }]}>
      {mark === undefined ? (
        <Text style={[styles.initial, { color: colors.foreground }]}>{bot.name.trim().charAt(0).toUpperCase()}</Text>
      ) : (
        <MarkIcon paths={mark} size={Math.round(size * 0.5)} color={colors.foreground} />
      )}
    </View>
  );
}

export function MarkIcon({ paths, size, color }: { paths: readonly string[]; size: number; color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontFamily: fontFamilies.display, fontSize: 14 },
});
