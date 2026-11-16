import { formatCost, usageBots, usageDays } from "@botsman/client-core";
import { useBots, useUsage } from "@botsman/client-core/react";
import { ErrorText, Page } from "../components/page.tsx";

const DAYS = 14;

// Spending over the last two weeks, by day and by bot.
export function UsageScreen() {
  const usage = useUsage(DAYS);
  const bots = useBots();
  const report = usage.value;
  const days = report === undefined ? [] : usageDays(report, DAYS);
  return (
    <Page title="Usage" subtitle="Last 14 days" back="#/">
      <ErrorText>{usage.error}</ErrorText>
      {report === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {report === undefined ? null : (
        <>
          <p className="text-sm">
            <span className="font-display text-2xl font-bold">{formatCost(report.total.cost)}</span> across the last {DAYS} days
          </p>
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Cost by day">
            {days.map((day) => (
              <span key={day.day} title={`${day.label}: ${formatCost(day.cost)}`} className="flex-1 rounded-sm bg-primary" style={{ height: `${Math.max(3, Math.round(day.share * 100))}%`, opacity: day.cost === 0 ? 0.25 : 1 }} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{days[0]?.label}</span>
            <span>{days.at(-1)?.label}</span>
          </div>
          <h2 className="font-display text-sm font-bold uppercase">By bot</h2>
          {report.bots.length === 0 ? <p className="text-sm text-muted-foreground">No replies in this period yet.</p> : null}
          {usageBots(report, bots).map((row) => (
            <div key={row.name} className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                {row.name}
                <span className="mt-1 block h-1.5 rounded-sm bg-muted">
                  <span className="block h-full rounded-sm bg-primary" style={{ width: `${Math.round(row.share * 100)}%` }} />
                </span>
              </span>
              <span className="font-mono">{formatCost(row.cost)}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Each finished reply also shows its own tokens and cost. History starts when the server began recording it.</p>
        </>
      )}
    </Page>
  );
}
