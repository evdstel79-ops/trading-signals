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
  type SignalScore,
} from "@/lib/signalScoring";

export const revalidate = 300;

type Source = "political" | "insider";

type RankedTicker = {
  ticker: string;
  sources: Set<Source>;
  tradesCount: number;
  score: SignalScore;
};

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
    { trades: ScorableTrade[]; sources: Set<Source> }
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
      sources: info.sources,
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
        <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 text-right font-medium">Traders</th>
              <th className="px-4 py-3 text-right font-medium">Trades</th>
              <th className="px-4 py-3 font-medium">Sources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {ranked.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No signals available right now.
                </td>
              </tr>
            )}
            {ranked.map((r, i) => (
              <tr
                key={r.ticker}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {i + 1}
                </td>
                <td className="px-4 py-3 font-mono text-sm font-semibold">
                  {r.ticker}
                </td>
                <td className="px-4 py-3">
                  <ScoreBar
                    score={r.score.score}
                    maxScore={maxScore}
                    direction={r.score.direction}
                  />
                </td>
                <td className="px-4 py-3">
                  <DirectionBadge direction={r.score.direction} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {r.score.uniqueTraders}
                  {r.score.consensusMultiplier > 1 && (
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                      ×{r.score.consensusMultiplier}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {r.tradesCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {r.sources.has("political") && <SourceBadge type="political" />}
                    {r.sources.has("insider") && <SourceBadge type="insider" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Last updated {lastUpdated} UTC · refreshes every 5 min ·{" "}
        {ranked.length} tickers · {political.length} political + {insider.length}{" "}
        insider trades
      </p>
    </div>
  );
}

function ScoreBar({
  score,
  maxScore,
  direction,
}: {
  score: number;
  maxScore: number;
  direction: SignalScore["direction"];
}) {
  const fillColor =
    direction === "bullish"
      ? "bg-emerald-500"
      : direction === "bearish"
        ? "bg-red-500"
        : "bg-neutral-400";
  const textColor =
    direction === "bullish"
      ? "text-emerald-700 dark:text-emerald-300"
      : direction === "bearish"
        ? "text-red-700 dark:text-red-300"
        : "text-neutral-600 dark:text-neutral-400";
  const widthPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full ${fillColor}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span
        className={`min-w-[2.5rem] font-mono text-xs font-semibold tabular-nums ${textColor}`}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: SignalScore["direction"] }) {
  const styles =
    direction === "bullish"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : direction === "bearish"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {direction}
    </span>
  );
}

function SourceBadge({ type }: { type: Source }) {
  if (type === "political") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        title="Political (Congress)"
      >
        P
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      title="Insider (SEC Form 4)"
    >
      I
    </span>
  );
}

function errorMsg(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown error";
}
