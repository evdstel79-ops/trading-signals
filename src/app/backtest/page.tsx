import Link from "next/link";

import BacktestChart from "@/components/BacktestChart";
import TickerLink from "@/components/TickerLink";
import { runBacktest, type BacktestResult, type BacktestTrade } from "@/lib/backtest";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";

export const revalidate = 300;

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export default async function BacktestPage() {
  let political: PoliticalTrade[] = [];
  let tradesError: string | null = null;
  try {
    political = await fetchPoliticalTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  let result: BacktestResult | null = null;
  let backtestError: string | null = null;
  if (political.length > 0) {
    try {
      result = await runBacktest(political);
    } catch (e) {
      backtestError = e instanceof Error ? e.message : "Unknown error";
    }
  }

  const eligibleBuys = political.filter(
    (t) => t.transactionType === "buy" && t.txDate && t.ticker,
  ).length;
  const skipped = result ? eligibleBuys - result.totalTrades : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Equal-weighted return of every political buy with a known transaction
          date, marked-to-market against today&apos;s close.
        </p>
      </header>

      {(tradesError || backtestError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {tradesError && <div>Political trades: {tradesError}</div>}
          {backtestError && <div>Backtest: {backtestError}</div>}
        </div>
      )}

      {result && (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Trades backtested"
              value={result.totalTrades.toLocaleString("en-US")}
              hint={
                skipped > 0
                  ? `${skipped} skipped (older than 1y or missing data)`
                  : "All eligible buys"
              }
            />
            <StatCard
              label="Win rate"
              value={pctFmt.format(result.winRate)}
            />
            <StatCard
              label="Avg return"
              value={formatSignedPct(result.avgReturn)}
              tone={
                result.avgReturn > 0
                  ? "positive"
                  : result.avgReturn < 0
                    ? "negative"
                    : "neutral"
              }
            />
            <StatCard
              label="Best trade"
              value={
                result.bestTrade
                  ? `${result.bestTrade.ticker} ${formatSignedPct(result.bestTrade.returnPct)}`
                  : "—"
              }
              hint={result.bestTrade ? result.bestTrade.txDate : undefined}
              tone="positive"
            />
            <StatCard
              label="Worst trade"
              value={
                result.worstTrade
                  ? `${result.worstTrade.ticker} ${formatSignedPct(result.worstTrade.returnPct)}`
                  : "—"
              }
              hint={result.worstTrade ? result.worstTrade.txDate : undefined}
              tone="negative"
            />
          </section>

          <BacktestChart series={result.series} />

          <TradesTable trades={result.trades} />

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Assumes equal position size per trade, entry at closing price on
            transaction date (or nearest preceding trading day), exit at
            today&apos;s close. Does not account for fees, slippage, or
            disclosure delay.
          </p>
        </>
      )}

      {!result && !tradesError && !backtestError && (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Loading political trades…
        </div>
      )}
    </div>
  );
}

function StatCard({
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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function TradesTable({ trades }: { trades: BacktestTrade[] }) {
  const sorted = [...trades].sort((a, b) =>
    a.txDate < b.txDate ? 1 : a.txDate > b.txDate ? -1 : 0,
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Tx date</th>
            <th className="px-4 py-3 font-medium">Politician</th>
            <th className="px-4 py-3 font-medium">Ticker</th>
            <th className="px-4 py-3 text-right font-medium">Entry price</th>
            <th className="px-4 py-3 text-right font-medium">Current price</th>
            <th className="px-4 py-3 text-right font-medium">Return</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
              >
                No backtested trades.
              </td>
            </tr>
          )}
          {sorted.map((t, i) => (
            <tr
              key={`${t.txDate}-${t.ticker}-${i}`}
              className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                {t.txDate}
              </td>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/politicians/${encodeURIComponent(t.politician)}`}
                  className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
                >
                  {t.politician}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <TickerLink ticker={t.ticker} />
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {currencyFmt.format(t.entryPrice)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {currencyFmt.format(t.currentPrice)}
              </td>
              <td className="px-4 py-3 text-right">
                <ReturnPct pct={t.returnPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <span className={`font-mono text-xs font-medium ${cls}`}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
