import Link from "next/link";
import { notFound } from "next/navigation";
import TickerLink from "@/components/TickerLink";
import {
  fetchPoliticalTrades,
  type Party,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes, type Quote } from "@/lib/quotes";

export const revalidate = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETURN_AGE_DAYS = 30;

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function PoliticianDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: rawParam } = await params;
  const memberName = decodeURIComponent(rawParam);

  let allTrades: PoliticalTrade[] = [];
  let tradesError: string | null = null;
  try {
    allTrades = await fetchPoliticalTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  const trades = allTrades.filter((t) => t.memberName === memberName);
  if (trades.length === 0 && !tradesError) notFound();

  const party = trades[0]?.party ?? "Unknown";
  const chamber = trades[0]?.chamber ?? "House";

  const tickers = Array.from(
    new Set(trades.map((t) => t.ticker).filter(Boolean)),
  );
  let quotes: Record<string, Quote | null> = {};
  let quotesError: string | null = null;
  try {
    quotes = await fetchQuotes(tickers);
  } catch (e) {
    quotesError = e instanceof Error ? e.message : "Unknown error";
  }

  const now = Date.now();
  const buyCount = trades.filter((t) => t.transactionType === "buy").length;
  const sellCount = trades.filter((t) => t.transactionType === "sell").length;
  const uniqueTickers = new Set(trades.map((t) => t.ticker).filter(Boolean))
    .size;

  const returns: number[] = [];
  for (const t of trades) {
    if (!t.tradePrice || !t.ticker) continue;
    const filedTs = Date.parse(t.filedAt);
    if (!Number.isFinite(filedTs)) continue;
    if ((now - filedTs) / DAY_MS < RETURN_AGE_DAYS) continue;
    const quote = quotes[t.ticker];
    if (!quote) continue;
    returns.push(((quote.price - t.tradePrice) / t.tradePrice) * 100);
  }
  const avgReturn =
    returns.length > 0
      ? returns.reduce((s, r) => s + r, 0) / returns.length
      : null;

  const sortedTrades = [...trades].sort((a, b) => {
    const aT = a.filedAt;
    const bT = b.filedAt;
    return aT < bT ? 1 : aT > bT ? -1 : 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/politicians"
          className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← All politicians
        </Link>
        <header className="mt-2 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {memberName}
          </h1>
          <PartyBadge party={party} />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {chamber}
          </span>
        </header>
      </div>

      {(tradesError || quotesError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {tradesError && <div>Political trades: {tradesError}</div>}
          {quotesError && <div>Live quotes: {quotesError}</div>}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total trades" value={trades.length.toString()} />
        <StatCard label="Buys / Sells" value={`${buyCount} / ${sellCount}`} />
        <StatCard label="Unique tickers" value={uniqueTickers.toString()} />
        <StatCard
          label="Avg return *"
          value={
            avgReturn === null
              ? "—"
              : `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`
          }
          tone={
            avgReturn === null
              ? "neutral"
              : avgReturn > 0
                ? "positive"
                : avgReturn < 0
                  ? "negative"
                  : "neutral"
          }
          hint={avgReturn === null ? "No trades >30d old" : `n=${returns.length}`}
        />
      </section>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filed</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">Trade price</th>
              <th className="px-4 py-3 text-right font-medium">Current</th>
              <th className="px-4 py-3 text-right font-medium">Return *</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedTrades.map((t, i) => {
              const filedTs = Date.parse(t.filedAt);
              const ageDays = Number.isFinite(filedTs)
                ? (now - filedTs) / DAY_MS
                : 0;
              const isPending = ageDays < RETURN_AGE_DAYS;
              const quote = t.ticker ? quotes[t.ticker] : null;
              const pct =
                !isPending && t.tradePrice && quote
                  ? ((quote.price - t.tradePrice) / t.tradePrice) * 100
                  : null;
              return (
                <tr
                  key={`${t.filedAt}-${t.ticker}-${i}`}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {t.filedAt}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <TickerLink ticker={t.ticker} />
                  </td>
                  <td className="px-4 py-3">
                    <SideBadge side={t.transactionType} />
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                    {t.amount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.tradePrice ? currencyFmt.format(t.tradePrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {quote ? currencyFmt.format(quote.price) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {isPending ? (
                      <span className="text-neutral-400 dark:text-neutral-600">
                        Pending
                      </span>
                    ) : pct === null ? (
                      <span className="text-neutral-400 dark:text-neutral-600">
                        —
                      </span>
                    ) : (
                      <ReturnPct pct={pct} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        * Estimated. Trade price is capitoltrades&apos; per-share estimate
        (typically the trade-date close), not the actual fill. Returns are
        computed only for trades older than 30 days; younger trades show
        &ldquo;Pending&rdquo;.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  hint?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${valueColor}`}>{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </div>
      )}
    </div>
  );
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
    >
      {label}
    </span>
  );
}

function SideBadge({ side }: { side: PoliticalTrade["transactionType"] }) {
  const styles =
    side === "buy"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : side === "sell"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : side === "exchange"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {side}
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
