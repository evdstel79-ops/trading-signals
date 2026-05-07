"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePnL,
  deletePaperTrade,
  loadPaperTrades,
  type PaperTrade,
} from "@/lib/paperTrades";

type Quote = { price: number; currency: string; symbol: string };
type QuotesResponse = {
  quotes: Record<string, Quote | null>;
};

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat("en-US");

export default function PaperTradingPage() {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  useEffect(() => {
    setTrades(loadPaperTrades());
  }, []);

  useEffect(() => {
    if (!trades || trades.length === 0) return;
    const tickers = Array.from(new Set(trades.map((t) => t.ticker))).filter(
      Boolean,
    );
    if (tickers.length === 0) return;

    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (cancelled) return;
        setQuotes(data.quotes ?? {});
      } catch (e) {
        if (cancelled) return;
        setQuotesError(
          e instanceof Error ? e.message : "Failed to fetch live prices",
        );
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trades]);

  function handleDelete(id: string) {
    if (!confirm("Delete this paper trade?")) return;
    setTrades(deletePaperTrade(id));
  }

  const summary = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { totalPnl: 0, openPositions: 0, biggestWin: null, biggestLoss: null };
    }
    let totalPnl = 0;
    let biggestWin: { trade: PaperTrade; pnl: number } | null = null;
    let biggestLoss: { trade: PaperTrade; pnl: number } | null = null;
    let anyPriced = false;

    for (const t of trades) {
      const q = quotes[t.ticker];
      if (!q) continue;
      anyPriced = true;
      const pnl = computePnL(t, q.price);
      totalPnl += pnl;
      if (pnl > 0 && (!biggestWin || pnl > biggestWin.pnl)) {
        biggestWin = { trade: t, pnl };
      }
      if (pnl < 0 && (!biggestLoss || pnl < biggestLoss.pnl)) {
        biggestLoss = { trade: t, pnl };
      }
    }

    return {
      totalPnl: anyPriced ? totalPnl : null,
      openPositions: trades.length,
      biggestWin,
      biggestLoss,
    };
  }, [trades, quotes]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Paper Trading</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Track simulated trades opened from political and insider signals. Live
          prices via Yahoo Finance.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total P&L"
          value={
            summary.totalPnl === null
              ? "—"
              : currencyFmt.format(summary.totalPnl)
          }
          tone={
            summary.totalPnl === null
              ? "neutral"
              : summary.totalPnl > 0
                ? "positive"
                : summary.totalPnl < 0
                  ? "negative"
                  : "neutral"
          }
          hint={quotesLoading ? "Refreshing prices…" : "Across all positions"}
        />
        <SummaryCard
          label="Open positions"
          value={String(summary.openPositions)}
          tone="neutral"
          hint="Saved paper trades"
        />
        <SummaryCard
          label="Biggest winner"
          value={
            summary.biggestWin
              ? `${summary.biggestWin.trade.ticker} ${currencyFmt.format(summary.biggestWin.pnl)}`
              : "—"
          }
          tone={summary.biggestWin ? "positive" : "neutral"}
          hint={summary.biggestWin?.trade.ticker ?? "No winners yet"}
        />
        <SummaryCard
          label="Biggest loser"
          value={
            summary.biggestLoss
              ? `${summary.biggestLoss.trade.ticker} ${currencyFmt.format(summary.biggestLoss.pnl)}`
              : "—"
          }
          tone={summary.biggestLoss ? "negative" : "neutral"}
          hint={summary.biggestLoss?.trade.ticker ?? "No losses yet"}
        />
      </section>

      {quotesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Live price fetch failed: {quotesError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date added</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Entry</th>
              <th className="px-4 py-3 text-right font-medium">Current</th>
              <th className="px-4 py-3 text-right font-medium">P&amp;L</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {trades === null && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {trades && trades.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No paper trades yet. Open one from the Political Trades or SEC
                  Insider Trades pages.
                </td>
              </tr>
            )}
            {trades?.map((t) => {
              const quote = quotes[t.ticker];
              const currentPrice = quote?.price ?? null;
              const pnl =
                currentPrice !== null ? computePnL(t, currentPrice) : null;
              return (
                <tr
                  key={t.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {new Date(t.addedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{t.ticker}</td>
                  <td className="px-4 py-3">
                    <DirectionBadge direction={t.direction} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {numberFmt.format(t.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {currencyFmt.format(t.entryPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {currentPrice === null ? (
                      quotesLoading ? (
                        <span className="inline-block h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                      ) : (
                        "—"
                      )
                    ) : (
                      currencyFmt.format(currentPrice)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs font-medium ${
                      pnl === null
                        ? "text-neutral-400"
                        : pnl > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : pnl < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-neutral-500"
                    }`}
                  >
                    {pnl === null ? "—" : currencyFmt.format(pnl)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                    {t.note || (
                      <span className="text-neutral-400 dark:text-neutral-600">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 lg:min-h-0"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  hint: string;
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
      <div className={`mt-2 truncate text-2xl font-semibold ${valueColor}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {hint}
      </div>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: PaperTrade["direction"] }) {
  const styles =
    direction === "buy"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {direction}
    </span>
  );
}
