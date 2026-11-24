import { useAppName } from "@botsman/client-core/react";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, radius, space, useTheme } from "../theme";

// The card the screens before the main app share: server address, setup, sign-in, and update notices.
export function EntryCard({ title, lede, error, children }: { title: string; lede: string; error?: string | undefined; children: ReactNode }) {
  const appName = useAppName();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>{appName.toUpperCase()}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{title.toUpperCase()}</Text>
            <Text style={[styles.lede, { color: colors.mutedForeground }]}>{lede}</Text>
            {children}
            {error === undefined ? null : (
              <Text accessibilityRole="alert" style={[styles.lede, { color: colors.destructive }]}>
                {error}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: space[4] },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[5], gap: space[4] },
  wordmark: { fontFamily: fontFamilies.displayRegular, fontSize: 18, letterSpacing: 6 },
  title: { fontFamily: fontFamilies.display, fontSize: 22, lineHeight: 30 },
  lede: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
});
