import Link from "next/link";
import { notFound } from "next/navigation";

import TickerLink from "@/components/TickerLink";
import {
  fetchInsiderTrades,
  type InsiderTrade,
} from "@/lib/insiderSignals";

export const revalidate = 300;

const numberFmt = new Intl.NumberFormat("en-US");
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const currencyFmt0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function InsiderDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: rawParam } = await params;
  const insiderName = decodeURIComponent(rawParam);

  let allTrades: InsiderTrade[] = [];
  let tradesError: string | null = null;
  try {
    allTrades = await fetchInsiderTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  const trades = allTrades.filter((t) => t.insiderName === insiderName);
  if (trades.length === 0 && !tradesError) notFound();

  const title =
    trades.find((t) => t.insiderTitle)?.insiderTitle ?? null;
  const buyCount = trades.filter((t) => t.transactionType === "buy").length;
  const sellCount = trades.filter((t) => t.transactionType === "sell").length;
  const uniqueTickers = new Set(
    trades.map((t) => t.ticker).filter(Boolean),
  ).size;
  const totalValue = trades.reduce((sum, t) => sum + (t.value || 0), 0);

  const sortedTrades = [...trades].sort((a, b) => {
    return a.filedAt < b.filedAt ? 1 : a.filedAt > b.filedAt ? -1 : 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/insiders"
          className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← All insiders
        </Link>
        <header className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {insiderName}
          </h1>
          {title && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {title}
            </span>
          )}
        </header>
      </div>

      {tradesError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Insider trades: {tradesError}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total trades" value={trades.length.toString()} />
        <StatCard label="Buys / Sells" value={`${buyCount} / ${sellCount}`} />
        <StatCard label="Unique tickers" value={uniqueTickers.toString()} />
        <StatCard
          label="Total value"
          value={totalValue > 0 ? currencyFmt0.format(totalValue) : "—"}
        />
      </section>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filed</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Shares</th>
              <th className="px-4 py-3 text-right font-medium">
                Price / share
              </th>
              <th className="px-4 py-3 text-right font-medium">Total value</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedTrades.map((t, i) => {
              const pricePerShare =
                t.shares > 0 && t.value > 0 ? t.value / t.shares : null;
              return (
                <tr
                  key={`${t.filingUrl}-${i}`}
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
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.shares
                      ? numberFmt.format(Math.round(t.shares))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {pricePerShare !== null
                      ? currencyFmt.format(pricePerShare)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.value > 0 ? currencyFmt0.format(t.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={t.filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neutral-500 hover:text-emerald-700 hover:underline dark:text-neutral-400 dark:hover:text-emerald-300"
                    >
                      Filing ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Price per share is derived from total filing value ÷ shares and may
        average across multiple sub-transactions in a single Form 4.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

function SideBadge({ side }: { side: InsiderTrade["transactionType"] }) {
  const styles =
    side === "buy"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : side === "sell"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {side}
    </span>
  );
}
