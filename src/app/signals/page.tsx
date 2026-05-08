import {
  fetchInsiderTrades,
  type InsiderTrade,
} from "@/lib/insiderSignals";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import {
  calculateSignalScore,
  type ScorableTrade,
} from "@/lib/signalScoring";
import SignalsTable, {
  type RankedTicker,
  type SignalSource,
} from "@/components/SignalsTable";

export const revalidate = 300;

export default async function SignalsPage() {
  const [polRes, insRes] = await Promise.allSettled([
    fetchPoliticalTrades(),
    fetchInsiderTrades(),
  ]);
  const political: PoliticalTrade[] =
    polRes.status === "fulfilled" ? polRes.value : [];
  const insider: InsiderTrade[] =
    insRes.status === "fulfilled" ? insRes.value : [];

  const polError = polRes.status === "rejected" ? errorMsg(polRes.reason) : null;
  const insError = insRes.status === "rejected" ? errorMsg(insRes.reason) : null;

  const byTicker = new Map<
    string,
    { trades: ScorableTrade[]; sources: Set<SignalSource> }
  >();

  for (const p of political) {
    if (!p.ticker) continue;
    const t = p.ticker.toUpperCase();
    let entry = byTicker.get(t);
    if (!entry) {
      entry = { trades: [], sources: new Set() };
      byTicker.set(t, entry);
    }
    entry.trades.push({
      filedAt: p.filedAt,
      amount: p.value,
      direction:
        p.transactionType === "buy"
          ? "buy"
          : p.transactionType === "sell"
            ? "sell"
            : "other",
      trader: p.memberName,
    });
    entry.sources.add("political");
  }

  for (const i of insider) {
    if (!i.ticker) continue;
    const t = i.ticker.toUpperCase();
    let entry = byTicker.get(t);
    if (!entry) {
      entry = { trades: [], sources: new Set() };
      byTicker.set(t, entry);
    }
    entry.trades.push({
      filedAt: i.filedAt,
      amount: i.value,
      direction: i.transactionType,
      trader: i.insiderName,
    });
    entry.sources.add("insider");
  }

  const ranked: RankedTicker[] = Array.from(byTicker.entries()).map(
    ([ticker, info]) => ({
      ticker,
      sources: Array.from(info.sources),
      tradesCount: info.trades.length,
      score: calculateSignalScore(info.trades),
    }),
  );

  ranked.sort((a, b) => {
    if (b.score.score !== a.score.score) return b.score.score - a.score.score;
    return b.tradesCount - a.tradesCount;
  });

  const maxScore = ranked[0]?.score.score ?? 0;

  const lastUpdated = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Signals</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Tickers ranked by combined political + insider trading activity.
          Score blends recency, dollar size, direction, and trader consensus.
        </p>
      </header>

      {(polError || insError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Some sources failed:
          {polError && <div className="mt-1">Political: {polError}</div>}
          {insError && <div className="mt-1">Insider: {insError}</div>}
        </div>
      )}

      <SignalsTable ranked={ranked} maxScore={maxScore} />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Last updated {lastUpdated} UTC · refreshes every 5 min ·{" "}
        {ranked.length} tickers · {political.length} political + {insider.length}{" "}
        insider trades
      </p>
    </div>
  );
}

function errorMsg(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown error";
}
