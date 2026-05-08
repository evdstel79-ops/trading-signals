import Link from "next/link";

import TickerLink from "@/components/TickerLink";
import {
  fetchInsiderTrades,
  type InsiderTrade,
} from "@/lib/insiderSignals";

export const revalidate = 300;

type InsiderStats = {
  name: string;
  title: string | null;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  uniqueTickers: number;
  mostRecent: string;
  mostTradedTicker: string | null;
};

export default async function InsidersPage() {
  let trades: InsiderTrade[] = [];
  let tradesError: string | null = null;
  try {
    trades = await fetchInsiderTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  const stats = computeStats(trades);
  stats.sort((a, b) => {
    if (b.buyCount !== a.buyCount) return b.buyCount - a.buyCount;
    return b.totalTrades - a.totalTrades;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Insiders</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Corporate insiders ranked by buy count. Source: SEC EDGAR Form 4
          filings.
        </p>
      </header>

      {tradesError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Insider trades: {tradesError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-right font-medium">#</th>
              <th className="px-4 py-3 font-medium">Insider</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 text-right font-medium">Trades</th>
              <th className="px-4 py-3 text-right font-medium">Tickers</th>
              <th className="px-4 py-3 font-medium">Most recent</th>
              <th className="px-4 py-3 font-medium">Most traded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {stats.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No insider trades available.
                </td>
              </tr>
            )}
            {stats.map((s, i) => (
              <tr
                key={s.name}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-3 text-right font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {i + 1}
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/insiders/${encodeURIComponent(s.name)}`}
                    className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                  {s.title ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {s.totalTrades}
                  </span>
                  <span className="ml-1 text-neutral-400 dark:text-neutral-600">
                    ({s.buyCount}B / {s.sellCount}S)
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {s.uniqueTickers}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                  {s.mostRecent}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {s.mostTradedTicker ? (
                    <TickerLink ticker={s.mostTradedTicker} />
                  ) : (
                    <span className="text-neutral-400 dark:text-neutral-600">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function computeStats(trades: InsiderTrade[]): InsiderStats[] {
  const byInsider = new Map<
    string,
    { trades: InsiderTrade[]; title: string | null }
  >();

  for (const t of trades) {
    if (!t.insiderName) continue;
    let entry = byInsider.get(t.insiderName);
    if (!entry) {
      entry = { trades: [], title: t.insiderTitle };
      byInsider.set(t.insiderName, entry);
    }
    entry.trades.push(t);
    if (!entry.title && t.insiderTitle) entry.title = t.insiderTitle;
  }

  return Array.from(byInsider.entries()).map(([name, info]) => {
    let buyCount = 0;
    let sellCount = 0;
    const tickers = new Set<string>();
    const tickerCounts = new Map<string, number>();
    let mostRecent = "";

    for (const t of info.trades) {
      if (t.transactionType === "buy") buyCount++;
      else if (t.transactionType === "sell") sellCount++;
      if (t.ticker) {
        tickers.add(t.ticker);
        tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) ?? 0) + 1);
      }
      if (t.filedAt > mostRecent) mostRecent = t.filedAt;
    }

    let mostTradedTicker: string | null = null;
    let topCount = 0;
    for (const [ticker, count] of tickerCounts) {
      if (count > topCount) {
        mostTradedTicker = ticker;
        topCount = count;
      }
    }

    return {
      name,
      title: info.title,
      totalTrades: info.trades.length,
      buyCount,
      sellCount,
      uniqueTickers: tickers.size,
      mostRecent: mostRecent || "—",
      mostTradedTicker,
    };
  });
}
