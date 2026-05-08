import Link from "next/link";

import MoversChart from "@/components/MoversChart";
import TickerLink from "@/components/TickerLink";
import { runBacktest, type BacktestTrade } from "@/lib/backtest";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";

export const revalidate = 300;

const TOP_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function MoversPage() {
  let political: PoliticalTrade[] = [];
  let tradesError: string | null = null;
  try {
    political = await fetchPoliticalTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  let backtestError: string | null = null;
  let trades: BacktestTrade[] = [];
  let bestTrade: BacktestTrade | null = null;
  let worstTrade: BacktestTrade | null = null;
  try {
    if (political.length > 0) {
      const result = await runBacktest(political);
      trades = result.trades;
      bestTrade = result.bestTrade;
      worstTrade = result.worstTrade;
    }
  } catch (e) {
    backtestError = e instanceof Error ? e.message : "Unknown error";
  }

  const now = Date.now();
  const gainerPool = dedupeTrades(
    trades.filter((t) => t.returnPct > 0),
    "best",
  );
  const loserPool = dedupeTrades(
    trades.filter((t) => t.returnPct < 0),
    "worst",
  );
  const gainers = [...gainerPool]
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, TOP_LIMIT);
  const losers = [...loserPool]
    .sort((a, b) => a.returnPct - b.returnPct)
    .slice(0, TOP_LIMIT);

  const avgDaysHeld =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + daysHeld(t.txDate, now), 0) /
        trades.length
      : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Top movers</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Best and worst political buy trades, ranked by mark-to-market return
          since the disclosed transaction date.
        </p>
      </header>

      {(tradesError || backtestError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {tradesError && <div>Political trades: {tradesError}</div>}
          {backtestError && <div>Backtest: {backtestError}</div>}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Biggest single gain"
          value={
            bestTrade
              ? `${bestTrade.ticker} ${formatSignedPct(bestTrade.returnPct)}`
              : "—"
          }
          hint={bestTrade?.txDate}
          tone="positive"
        />
        <SummaryCard
          label="Biggest single loss"
          value={
            worstTrade
              ? `${worstTrade.ticker} ${formatSignedPct(worstTrade.returnPct)}`
              : "—"
          }
          hint={worstTrade?.txDate}
          tone="negative"
        />
        <SummaryCard
          label="Avg days held"
          value={
            avgDaysHeld === null
              ? "—"
              : `${Math.round(avgDaysHeld)} day${
                  Math.round(avgDaysHeld) === 1 ? "" : "s"
                }`
          }
          hint={
            trades.length > 0
              ? `${trades.length} trades backtested`
              : undefined
          }
        />
      </section>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No backtested trades available.
        </div>
      ) : (
        <>
          <MoversChart
            gainers={gainers.map((t) => ({
              ticker: t.ticker,
              returnPct: t.returnPct,
              txDate: t.txDate,
            }))}
            losers={losers.map((t) => ({
              ticker: t.ticker,
              returnPct: t.returnPct,
              txDate: t.txDate,
            }))}
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MoversTable
              title="Top gainers"
              accent="emerald"
              trades={gainers}
              empty="No positive returns yet."
              now={now}
            />
            <MoversTable
              title="Top losers"
              accent="red"
              trades={losers}
              empty="No negative returns yet."
              now={now}
            />
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className={`mt-2 truncate text-xl font-semibold ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function MoversTable({
  title,
  accent,
  trades,
  empty,
  now,
}: {
  title: string;
  accent: "emerald" | "red";
  trades: BacktestTrade[];
  empty: string;
  now: number;
}) {
  const dotClass =
    accent === "emerald" ? "bg-emerald-500" : "bg-red-500";
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {trades.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {empty}
        </div>
      ) : (
        <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {trades.map((t, i) => {
            const days = daysHeld(t.txDate, now);
            return (
              <li
                key={`${t.ticker}-${t.txDate}-${i}`}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 px-4 py-3 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-sm font-semibold">
                      <TickerLink ticker={t.ticker} />
                    </span>
                    <Link
                      href={`/politicians/${encodeURIComponent(t.politician)}`}
                      className="truncate text-neutral-700 hover:text-emerald-700 hover:underline dark:text-neutral-300 dark:hover:text-emerald-300"
                    >
                      {t.politician}
                    </Link>
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t.txDate} · {currencyFmt.format(t.entryPrice)} →{" "}
                    {currencyFmt.format(t.currentPrice)} ·{" "}
                    {days} day{days === 1 ? "" : "s"} held
                  </div>
                </div>
                <ReturnBadge pct={t.returnPct} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ReturnBadge({ pct }: { pct: number }) {
  const cls =
    pct > 0
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : pct < 0
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${cls}`}
    >
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

/**
 * Collapse trades that share (ticker, politician, txDate). Keeps the row with
 * the highest returnPct ('best') or lowest returnPct ('worst').
 */
function dedupeTrades(
  trades: BacktestTrade[],
  pick: "best" | "worst",
): BacktestTrade[] {
  const byKey = new Map<string, BacktestTrade>();
  for (const t of trades) {
    const key = `${t.ticker}|${t.politician}|${t.txDate}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, t);
      continue;
    }
    const keep =
      pick === "best"
        ? t.returnPct > existing.returnPct
        : t.returnPct < existing.returnPct;
    if (keep) byKey.set(key, t);
  }
  return Array.from(byKey.values());
}

function daysHeld(txDate: string, now: number): number {
  const ts = Date.parse(txDate);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.round((now - ts) / DAY_MS));
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
