"use client";

import WatchlistButton from "@/components/WatchlistButton";
import { useWatchlist } from "@/lib/watchlist";
import type { Correlation } from "@/lib/tradeCorrelation";
import type { Party } from "@/lib/politicalSignals";

export type CorrelationRow = Correlation & {
  /** Party-resolved politicians, paired by index with `politicians`. */
  politicianParties: Party[];
};

export default function CorrelationsTable({
  rows,
  maxScore,
}: {
  rows: CorrelationRow[];
  maxScore: number;
}) {
  const { isWatched, toggle } = useWatchlist();

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Ticker</th>
            <th className="px-4 py-3 font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Politicians</th>
            <th className="px-4 py-3 text-right font-medium">Buys / Sells</th>
            <th className="px-4 py-3 font-medium">Window</th>
            <th className="px-4 py-3 font-medium">Tags</th>
            <th className="px-4 py-3 text-right font-medium">Watchlist</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
              >
                No correlated trades in the current dataset. A correlation is
                detected when 2+ unique politicians trade the same ticker
                within a 90-day window.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
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
                <ScoreBar score={r.correlationScore} maxScore={maxScore} />
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {r.politicians.map((name, idx) => (
                    <PoliticianChip
                      key={name}
                      name={name}
                      party={r.politicianParties[idx] ?? "Unknown"}
                    />
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {r.buyCount}B
                </span>{" "}
                /{" "}
                <span className="text-red-600 dark:text-red-400">
                  {r.sellCount}S
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                {r.firstTrade === r.lastTrade
                  ? r.firstTrade
                  : `${r.firstTrade} → ${r.lastTrade}`}
                <span className="ml-1 text-neutral-400 dark:text-neutral-600">
                  ({r.windowDays}d)
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {r.bipartisan && (
                    <span className="inline-flex rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                      bipartisan
                    </span>
                  )}
                  {r.buyCount > r.sellCount && (
                    <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      buy-heavy
                    </span>
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

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const widthPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-amber-500"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="min-w-[2rem] font-mono text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
        {score}
      </span>
    </div>
  );
}

function PoliticianChip({ name, party }: { name: string; party: Party }) {
  const dot =
    party === "R"
      ? "bg-red-500"
      : party === "D"
        ? "bg-blue-500"
        : party === "I"
          ? "bg-purple-500"
          : "bg-neutral-400";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      title={party}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {name}
    </span>
  );
}
