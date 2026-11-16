import { formatCost, usageBots, usageDays } from "@botsman/client-core";
import { useBots, useUsage } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../src/theme";
import { ErrorText, Note, Page, pageStyles, SectionTitle } from "../src/ui/page";

const DAYS = 14;

// Spending over the last two weeks, by day and by bot.
export default function UsageScreen() {
  const { colors } = useTheme();
  const usage = useUsage(DAYS);
  const bots = useBots();
  const report = usage.value;
  const days = report === undefined ? [] : usageDays(report, DAYS);
  return (
    <Page title="Usage" subtitle="Last 14 days">
      <ErrorText>{usage.error}</ErrorText>
      {report === undefined ? <Note>Loading…</Note> : null}
      {report === undefined ? null : (
        <>
          <Text style={[styles.total, { color: colors.foreground }]}>{formatCost(report.total.cost)}</Text>
          <Note>{`across the last ${DAYS} days`}</Note>
          <View style={styles.bars} accessibilityLabel="Cost by day">
            {days.map((day) => (
              <View key={day.day} style={[styles.bar, { backgroundColor: colors.primary, height: `${Math.max(3, Math.round(day.share * 100))}%`, opacity: day.cost === 0 ? 0.25 : 1 }]} />
            ))}
          </View>
          <View style={styles.labels}>
            <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{days[0]?.label}</Text>
            <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{days.at(-1)?.label}</Text>
          </View>
          <SectionTitle>By bot</SectionTitle>
          {report.bots.length === 0 ? <Note>No replies in this period yet.</Note> : null}
          {usageBots(report, bots).map((row) => (
            <View key={row.name} style={styles.botRow}>
              <View style={styles.grow}>
                <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{row.name}</Text>
                <View style={[styles.meter, { backgroundColor: colors.muted }]}>
                  <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.round(row.share * 100)}%` }]} />
                </View>
              </View>
              <Text style={[styles.cost, { color: colors.foreground }]}>{formatCost(row.cost)}</Text>
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
