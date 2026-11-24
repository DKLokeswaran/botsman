import type { Approval, Bot } from "@botsman/client-core";
import { useAppName, useBotRow, useBots, useConnectionLine, useNeedsYou, useNeedsYouRow, useServerState } from "@botsman/client-core/react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, radius, space, useTheme } from "../src/theme";
import { Avatar } from "../src/ui/avatar";

// The phone's home screen: what needs the owner, then the bots, with the main bot first.
export default function BotListScreen() {
  const appName = useAppName();
  const { colors } = useTheme();
  const { status } = useServerState();
  const bots = useBots();
  const needsYou = useNeedsYou();
  const connection = useConnectionLine();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: colors.foreground }]}>{appName.toUpperCase()}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/usage")} hitSlop={8}>
          <Text style={[styles.link, { color: colors.foreground }]}>Usage</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/settings")} hitSlop={8}>
          <Text style={[styles.link, { color: colors.foreground }]}>Settings</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {needsYou.length === 0 ? null : <SectionTitle>Needs you</SectionTitle>}
        {needsYou.map((approval) => (
          <NeedsYouRow key={approval.id} approval={approval} />
        ))}
        <SectionTitle>Bots</SectionTitle>
        {status === "loading" ? <Text style={[styles.sub, { color: colors.mutedForeground }]}>Loading…</Text> : null}
        {bots.map((bot) => (
          <BotRow key={bot.id} bot={bot} />
        ))}
        <Pressable accessibilityRole="button" onPress={() => router.push("/new-bot")} style={styles.newBot}>
          <Text style={[styles.needs, { color: colors.primary }]}>New bot</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text numberOfLines={1} accessibilityRole="text" style={[styles.status, { color: colors.mutedForeground }]}>
          {connection}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function openChat(botId: string): void {
  router.push({ pathname: "/chat/[botId]", params: { botId } });
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.section, { color: colors.primary }]}>{children}</Text>;
}

function NeedsYouRow({ approval }: { approval: Approval }) {
  const { colors } = useTheme();
  const { line, countdown } = useNeedsYouRow(approval);
  return (
    <Pressable accessibilityRole="button" onPress={() => openChat(approval.botId)} android_ripple={{ color: colors.accent }} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <View style={styles.rowText}>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {line}
        </Text>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>
          {approval.description}
        </Text>
      </View>
      <Text style={[styles.mono, { color: colors.mutedForeground }]}>{countdown}</Text>
    </Pressable>
  );
}

function BotRow({ bot }: { bot: Bot }) {
  const { colors } = useTheme();
  const row = useBotRow(bot);
  return (
    <Pressable accessibilityRole="button" onPress={() => openChat(bot.id)} android_ripple={{ color: colors.accent }} style={styles.row}>
      <Avatar bot={bot} size={44} />
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.botName, { color: colors.foreground }]}>
            {bot.name.toUpperCase()}
          </Text>
          {bot.isMain ? <Text style={[styles.sub, { color: colors.mutedForeground }]}>Main</Text> : null}
        </View>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.mutedForeground }]}>
          {row.subtitle}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{row.time}</Text>
        {row.working ? (
          <View style={styles.working}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.needs, { color: colors.foreground }]}>Working</Text>
          </View>
        ) : null}
        {row.needsYou ? <Text style={[styles.needs, { color: colors.foreground }]}>Needs you</Text> : null}
        {row.unread === "" ? null : (
          <Text accessibilityLabel={`${row.unread} unread`} style={[styles.badge, { backgroundColor: colors.primary, color: colors.primaryForeground }]}>
            {row.unread}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: space[4], paddingRight: space[4] },
  link: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
  wordmark: { flex: 1, fontFamily: fontFamilies.display, fontSize: 18, letterSpacing: 6, paddingHorizontal: space[4], paddingVertical: space[4] },
  list: { paddingHorizontal: space[2], paddingBottom: space[4] },
  section: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14, paddingHorizontal: space[2], paddingTop: space[4], paddingBottom: space[2] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[2], paddingVertical: space[3], borderRadius: radius.md },
  rowText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: space[2] },
  botName: { fontFamily: fontFamilies.display, fontSize: 14, flexShrink: 1 },
  rowTitle: { fontFamily: fontFamilies.body, fontSize: 14 },
  sub: { fontFamily: fontFamilies.body, fontSize: 12 },
  mono: { fontFamily: fontFamilies.mono, fontSize: 12 },
  needs: { fontFamily: fontFamilies.bodySemiBold, fontSize: 12 },
  newBot: { paddingHorizontal: space[2], paddingVertical: space[3] },
  working: { flexDirection: "row", alignItems: "center", gap: space[1] },
  rowEnd: { alignItems: "flex-end", gap: space[1] },
  badge: { fontFamily: fontFamilies.mono, fontSize: 12, minWidth: 20, textAlign: "center", paddingHorizontal: 6, borderRadius: 10, overflow: "hidden" },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: space[1] },
  footer: { flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: 1, padding: space[3] },
  status: { flex: 1, fontFamily: fontFamilies.body, fontSize: 12 },
});
