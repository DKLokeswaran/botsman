import { useUsage } from "@botsman/client-core/react";
import { ErrorText, Page } from "../components/page.tsx";

// Spending over the last two weeks, by day and by bot.
export function UsageScreen() {
  const { view, error, days } = useUsage();
  return (
    <Page title="Usage" subtitle={`Last ${days} days`} back="#/">
      <ErrorText>{error}</ErrorText>
      {view === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {view === undefined ? null : (
        <>
          <p className="text-sm">
            <span className="font-display text-2xl font-bold">{view.total}</span> across the last {days} days
          </p>
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Cost by day">
            {view.days.map((day) => (
              <span key={day.day} title={`${day.label}: ${day.cost}`} className="flex-1 rounded-sm bg-primary" style={{ height: day.height, opacity: day.opacity }} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{view.ends.first}</span>
            <span>{view.ends.last}</span>
          </div>
          <h2 className="font-display text-sm font-bold uppercase">By bot</h2>
          {view.empty ? <p className="text-sm text-muted-foreground">No replies in this period yet.</p> : null}
          {view.bots.map((row) => (
            <div key={row.name} className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                {row.name}
                <span className="mt-1 block h-1.5 rounded-sm bg-muted">
                  <span className="block h-full rounded-sm bg-primary" style={{ width: row.width }} />
                </span>
              </span>
              <span className="font-mono">{row.cost}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Each finished reply also shows its own tokens and cost. History starts when the server began recording it.</p>
        </>
      )}
    </Page>
  );
}
