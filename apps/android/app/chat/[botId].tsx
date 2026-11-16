import { type ChatItem, chatSubtitle, contextTokens, modelProblem } from "@botsman/client-core";
import { useBot, useChat, useConnectionStatus, useModels } from "@botsman/client-core/react";
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
  const { models, loading } = useModels();
  const problem = loading || state.status === "loading" ? undefined : modelProblem(models, state.settings.model);

  if (bot === undefined) return <Text style={[styles.missing, { color: colors.mutedForeground }]}>This bot no longer exists.</Text>;
  const busy = state.live.running || state.live.compacting;
  const openInfo = () => router.push({ pathname: "/bot/[botId]", params: { botId: bot.id } });
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to bots" onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.foreground }]}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${bot.name} info`} onPress={openInfo} hitSlop={4}>
            <Avatar bot={bot} size={36} />
          </Pressable>
          <View style={styles.headerText}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${bot.name} info`} onPress={openInfo} hitSlop={{ top: 8, bottom: 2 }}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
                {bot.name.toUpperCase()}
              </Text>
            </Pressable>
            <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>
              {chatSubtitle(state.settings, state.totals.usage.cost, models, contextTokens(state.messages))}
            </Text>
          </View>
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
        {problem === undefined ? null : (
          <Pressable accessibilityRole="button" onPress={() => router.push("/providers")} style={[styles.problem, { borderColor: colors.primary }]}>
            <Text style={[styles.sub, { color: colors.foreground }]}>{problem}</Text>
            <Text style={[styles.sub, { color: colors.primary }]}>Model providers ›</Text>
          </Pressable>
        )}
        <View style={styles.composer}>
          <Composer chat={chat} bot={bot} settings={state.settings} sendModes={sendModes} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2], borderBottomWidth: 1 },
  problem: { marginHorizontal: space[3], marginBottom: space[2], borderWidth: 1, borderRadius: 4, padding: space[3], gap: space[1] },
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
