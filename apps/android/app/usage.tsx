import { useUsage } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../src/theme";
import { ErrorText, Note, Page, pageStyles, SectionTitle } from "../src/ui/page";

// Spending over the last two weeks, by day and by bot.
export default function UsageScreen() {
  const { colors } = useTheme();
  const { view, error, days } = useUsage();
  return (
    <Page title="Usage" subtitle={`Last ${days} days`}>
      <ErrorText>{error}</ErrorText>
      {view === undefined ? <Note>Loading…</Note> : null}
      {view === undefined ? null : (
        <>
          <Text style={[styles.total, { color: colors.foreground }]}>{view.total}</Text>
          <Note>{`across the last ${days} days`}</Note>
          <View style={styles.bars} accessibilityLabel="Cost by day">
            {view.days.map((day) => (
              <View key={day.day} style={[styles.bar, { backgroundColor: colors.primary, height: day.height, opacity: day.opacity }]} />
            ))}
          </View>
          <View style={styles.labels}>
            <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{view.ends.first}</Text>
            <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{view.ends.last}</Text>
          </View>
          <SectionTitle>By bot</SectionTitle>
          {view.empty ? <Note>No replies in this period yet.</Note> : null}
          {view.bots.map((row) => (
            <View key={row.name} style={styles.botRow}>
              <View style={styles.grow}>
                <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{row.name}</Text>
                <View style={[styles.meter, { backgroundColor: colors.muted }]}>
                  <View style={[styles.fill, { backgroundColor: colors.primary, width: row.width }]} />
                </View>
              </View>
              <Text style={[styles.cost, { color: colors.foreground }]}>{row.cost}</Text>
            </View>
          ))}
          <Note>Each finished reply also shows its own tokens and cost. History starts when the server began recording it.</Note>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  total: { fontFamily: fontFamilies.display, fontSize: 28 },
  bars: { height: 128, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { flex: 1, borderRadius: 2 },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  botRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  grow: { flex: 1, gap: space[1] },
  meter: { height: 6, borderRadius: radius.md },
  fill: { height: 6, borderRadius: radius.md },
  cost: { fontFamily: fontFamilies.mono, fontSize: 13 },
});
