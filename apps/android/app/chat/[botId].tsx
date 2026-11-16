import { type ChatItem, chatSubtitle } from "@botsman/client-core";
import { useBot, useChat, useConnectionStatus } from "@botsman/client-core/react";
import { LegendList } from "@legendapp/list/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatItemView } from "../../src/chat/chat-items";
import { Composer } from "../../src/chat/composer";
import { fontFamilies, space, useTheme } from "../../src/theme";
import { Avatar } from "../../src/ui/avatar";
import { Button } from "../../src/ui/button";

// One bot's chat with the owner.
export default function ChatScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { colors } = useTheme();
  const bot = useBot(botId);
  const { chat, state, items, sendModes } = useChat(botId);
  const reconnecting = useConnectionStatus() === "reconnecting";

  if (bot === undefined) return <Text style={[styles.missing, { color: colors.mutedForeground }]}>This bot no longer exists.</Text>;
  const busy = state.live.running || state.live.compacting;
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to bots" onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.foreground }]}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${bot.name} info`} onPress={() => router.push({ pathname: "/bot/[botId]", params: { botId: bot.id } })} style={styles.headerLink}>
            <Avatar bot={bot} size={36} />
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
                {bot.name.toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>
                {chatSubtitle(state.settings, state.totals.usage.cost)}
              </Text>
            </View>
          </Pressable>
        </View>
        {reconnecting ? <Text style={[styles.banner, { color: colors.primary, backgroundColor: colors.card, borderBottomColor: colors.border }]}>Reconnecting…</Text> : null}
        <LegendList
          data={items}
          keyExtractor={(item: ChatItem) => item.id}
          renderItem={({ item }: { item: ChatItem }) => (
            <View style={styles.item}>
              <ChatItemView item={item} chat={chat} botName={bot.name} />
            </View>
          )}
          estimatedItemSize={120}
          alignItemsAtEnd
          initialScrollAtEnd
          maintainScrollAtEnd
          maintainVisibleContentPosition
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={state.hasEarlier ? <Button label="Show earlier messages" variant="text" onPress={() => void chat.loadEarlier()} /> : null}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedForeground }]}>{state.status === "loading" ? "Loading…" : `Say hello to ${bot.name}.`}</Text>}
        />
        <View style={styles.composer}>
          <Composer chat={chat} botName={bot.name} sendModes={sendModes} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2], borderBottomWidth: 1 },
  headerLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  back: { fontSize: 30, lineHeight: 32, paddingHorizontal: space[1] },
  name: { fontFamily: fontFamilies.display, fontSize: 15 },
  sub: { fontFamily: fontFamilies.body, fontSize: 12 },
  banner: { fontFamily: fontFamilies.body, fontSize: 12, textAlign: "center", paddingVertical: space[1], borderBottomWidth: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: space[4], paddingVertical: space[4] },
  item: { paddingVertical: space[2] },
  empty: { fontFamily: fontFamilies.body, fontSize: 14, textAlign: "center", padding: space[5] },
  composer: { paddingHorizontal: space[3], paddingBottom: space[3] },
  missing: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fontFamilies.body, fontSize: 14 },
});
