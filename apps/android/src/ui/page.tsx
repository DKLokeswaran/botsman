import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, radius, space, useTheme } from "../theme";

// A settings-style screen: a header with a back button, then a scrolling column.
export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.foreground }]}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
            {title.toUpperCase()}
          </Text>
          {subtitle === undefined ? null : <Text style={[styles.small, { color: colors.mutedForeground }]}>{subtitle}</Text>}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// A row that opens another screen.
export function LinkRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: colors.accent }} style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: colors.foreground }]}>›</Text>
    </Pressable>
  );
}

// An on or off switch with a label and a line of detail.
export function ToggleRow({ title, detail, on, onChange }: { title: string; detail: string; on: boolean; onChange: (on: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <Switch accessibilityLabel={title} value={on} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.muted }} thumbColor={colors.foreground} />
    </View>
  );
}

// Several choices in one strip, with the chosen one filled.
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segments, { borderColor: colors.border }]}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => onChange(option.value)} style={[styles.segment, chosen && { backgroundColor: colors.primary }]}>
            <Text style={[styles.rowTitle, { color: chosen ? colors.primaryForeground : colors.foreground }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ErrorText({ children }: { children: string | undefined }) {
  const { colors } = useTheme();
  return children === undefined ? null : <Text style={[styles.text, { color: colors.destructive }]}>{children}</Text>;
}

export function Note({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.text, { color: colors.mutedForeground }]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.section, { color: colors.foreground }]}>{children.toUpperCase()}</Text>;
}

export const pageStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space[3], borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[3] },
  rowTitle: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
  small: { fontFamily: fontFamilies.body, fontSize: 12 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2], borderBottomWidth: 1, minHeight: 52 },
  headerText: { flex: 1, minWidth: 0 },
  back: { fontSize: 30, lineHeight: 32, paddingHorizontal: space[1] },
  title: { fontFamily: fontFamilies.display, fontSize: 15 },
  body: { padding: space[4], gap: space[4] },
  row: pageStyles.row,
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: pageStyles.rowTitle,
  small: pageStyles.small,
  text: { fontFamily: fontFamilies.body, fontSize: 14 },
  section: { fontFamily: fontFamilies.display, fontSize: 13 },
  segments: { flexDirection: "row", borderWidth: 1, borderRadius: radius.md, padding: 2 },
  segment: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.md - 1 },
});
