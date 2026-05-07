"use client";

import WatchlistButton from "@/components/WatchlistButton";
import { useWatchlist } from "@/lib/watchlist";
import type { SignalScore } from "@/lib/signalScoring";

export type SignalSource = "political" | "insider";

export type RankedTicker = {
  ticker: string;
  sources: SignalSource[];
  tradesCount: number;
  score: SignalScore;
};

export default function SignalsTable({
  ranked,
  maxScore,
}: {
  ranked: RankedTicker[];
  maxScore: number;
}) {
  const { isWatched, toggle } = useWatchlist();

  return (
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
            <th className="px-4 py-3 text-right font-medium">Watchlist</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {ranked.length === 0 && (
            <tr>
              <td
                colSpan={8}
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
                  {r.sources.includes("political") && (
                    <SourceBadge type="political" />
                  )}
                  {r.sources.includes("insider") && (
                    <SourceBadge type="insider" />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <WatchlistButton
                  ticker={r.ticker}
                  watched={isWatched(r.ticker)}
                  onToggle={toggle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function SourceBadge({ type }: { type: SignalSource }) {
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
