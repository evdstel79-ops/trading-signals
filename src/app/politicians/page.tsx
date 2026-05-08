import Link from "next/link";
import {
  fetchPoliticalTrades,
  type Party,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes, type Quote } from "@/lib/quotes";

export const revalidate = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETURN_AGE_DAYS = 30;

type PoliticianStats = {
  name: string;
  party: Party;
  chamber: PoliticalTrade["chamber"];
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  uniqueTickers: number;
  avgReturn: number | null;
  best: { ticker: string; pct: number } | null;
  returnsCount: number;
};

export default async function PoliticiansPage() {
  let trades: PoliticalTrade[] = [];
  let tradesError: string | null = null;
  try {
    trades = await fetchPoliticalTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  const allTickers = Array.from(
    new Set(trades.map((t) => t.ticker).filter(Boolean)),
  );
  let quotes: Record<string, Quote | null> = {};
  let quotesError: string | null = null;
  try {
    quotes = await fetchQuotes(allTickers);
  } catch (e) {
    quotesError = e instanceof Error ? e.message : "Unknown error";
  }

  const stats = computeStats(trades, quotes);
  stats.sort((a, b) => {
    if (a.avgReturn === null && b.avgReturn === null) {
      return b.totalTrades - a.totalTrades;
    }
    if (a.avgReturn === null) return 1;
    if (b.avgReturn === null) return -1;
    return b.avgReturn - a.avgReturn;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Politicians</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Members of Congress ranked by estimated trading return. Returns are
          computed for trades older than 30 days using capitoltrades&apos;
          per-share price estimate vs. current Yahoo Finance close.
        </p>
      </header>

      {(tradesError || quotesError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {tradesError && <div>Political trades: {tradesError}</div>}
          {quotesError && <div>Live quotes: {quotesError}</div>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Politician</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Chamber</th>
              <th className="px-4 py-3 text-right font-medium">Trades</th>
              <th className="px-4 py-3 text-right font-medium">Tickers</th>
              <th className="px-4 py-3 text-right font-medium">Avg return *</th>
              <th className="px-4 py-3 font-medium">Best trade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {stats.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No political trades available.
                </td>
              </tr>
            )}
            {stats.map((s) => (
              <tr
                key={s.name}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/politicians/${encodeURIComponent(s.name)}`}
                    className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <PartyBadge party={s.party} />
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {s.chamber}
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
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {s.avgReturn === null ? (
                    <span className="text-neutral-400 dark:text-neutral-600">
                      —
                    </span>
                  ) : (
                    <ReturnPct pct={s.avgReturn} />
                  )}
                  {s.avgReturn !== null && (
                    <span className="ml-1 text-[10px] text-neutral-400 dark:text-neutral-600">
                      (n={s.returnsCount})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.best ? (
                    <span className="font-mono text-xs">
                      <span className="font-semibold">{s.best.ticker}</span>{" "}
                      <ReturnPct pct={s.best.pct} />
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        * Estimated. Per-share price reported by capitoltrades is typically the
        trade-date close, not the actual fill. Share quantity is not disclosed
        under the STOCK Act, so per-position dollar P&amp;L cannot be derived.
      </p>
    </div>
  );
}

function computeStats(
  trades: PoliticalTrade[],
  quotes: Record<string, Quote | null>,
): PoliticianStats[] {
  const now = Date.now();
  const byPolitician = new Map<
    string,
    {
      trades: PoliticalTrade[];
      party: Party;
      chamber: PoliticalTrade["chamber"];
    }
  >();

  for (const t of trades) {
    if (!t.memberName) continue;
    let entry = byPolitician.get(t.memberName);
    if (!entry) {
      entry = { trades: [], party: t.party, chamber: t.chamber };
      byPolitician.set(t.memberName, entry);
    }
    entry.trades.push(t);
  }

  return Array.from(byPolitician.entries()).map(([name, info]) => {
    let buyCount = 0;
    let sellCount = 0;
    const tickers = new Set<string>();
    const returns: { ticker: string; pct: number }[] = [];

    for (const t of info.trades) {
      if (t.transactionType === "buy") buyCount++;
      else if (t.transactionType === "sell") sellCount++;
      if (t.ticker) tickers.add(t.ticker);

      if (!t.tradePrice || !t.ticker) continue;
      const filedTs = Date.parse(t.filedAt);
      if (!Number.isFinite(filedTs)) continue;
      const ageDays = (now - filedTs) / DAY_MS;
      if (ageDays < RETURN_AGE_DAYS) continue;
      const quote = quotes[t.ticker];
      if (!quote) continue;
      const pct = ((quote.price - t.tradePrice) / t.tradePrice) * 100;
      returns.push({ ticker: t.ticker, pct });
    }

    const avgReturn =
      returns.length > 0
        ? returns.reduce((sum, r) => sum + r.pct, 0) / returns.length
        : null;
    const best =
      returns.length > 0
        ? returns.reduce((b, r) => (r.pct > b.pct ? r : b), returns[0])
        : null;

    return {
      name,
      party: info.party,
      chamber: info.chamber,
      totalTrades: info.trades.length,
      buyCount,
      sellCount,
      uniqueTickers: tickers.size,
      avgReturn,
      best,
      returnsCount: returns.length,
    };
  });
}

function PartyBadge({ party }: { party: Party }) {
  const styles =
    party === "R"
      ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
      : party === "D"
        ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
        : party === "I"
          ? "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900"
          : "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700";
  const label = party === "Unknown" ? "—" : party;
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${styles}`}
      title={
        party === "R"
          ? "Republican"
          : party === "D"
            ? "Democrat"
            : party === "I"
              ? "Independent"
              : "Unknown"
      }
    >
      {label}
    </span>
  );
}

function ReturnPct({ pct }: { pct: number }) {
  const cls =
    pct > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : pct < 0
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-500 dark:text-neutral-400";
  return (
    <span className={`font-medium ${cls}`}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}
