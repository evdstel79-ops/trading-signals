"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  effectivePrice,
  loadPaperTrades,
  tradePnL,
  type PaperTrade,
} from "@/lib/paperTrades";

type Quote = {
  price: number;
  previousClose: number | null;
  symbol: string;
};
type QuotesResponse = { quotes: Record<string, Quote | null> };

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function BriefingPortfolio() {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});

  useEffect(() => {
    setTrades(loadPaperTrades());
  }, []);

  useEffect(() => {
    if (!trades || trades.length === 0) return;
    const tickers = Array.from(
      new Set(
        trades
          .filter((t) => !t.closedAt)
          .map((t) => t.ticker)
          .filter(Boolean),
      ),
    );
    if (tickers.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (!cancelled) setQuotes(data.quotes ?? {});
      } catch {
        // Soft-fail; the card just won't show the live numbers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trades]);

  const summary = useMemo(() => computeSummary(trades, quotes), [trades, quotes]);

  return (
    <BriefingCard title="Your portfolio" linkHref="/paper-trading">
      {trades === null ? (
        <Skeleton />
      ) : summary.openCount === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No open positions
        </p>
      ) : (
        <>
          <div
            className={`text-2xl font-semibold ${
              summary.totalPnl === null
                ? "text-neutral-700 dark:text-neutral-300"
                : summary.totalPnl > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : summary.totalPnl < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-neutral-700 dark:text-neutral-300"
            }`}
          >
            {summary.totalPnl === null
              ? "—"
              : `${summary.totalPnl >= 0 ? "+" : ""}${currencyFmt.format(summary.totalPnl)}`}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {summary.openCount} open position
            {summary.openCount === 1 ? "" : "s"}
            {summary.bestToday && (
              <>
                {" · best today "}
                <Link
                  href={`/ticker/${encodeURIComponent(summary.bestToday.ticker)}`}
                  className="font-mono font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  {summary.bestToday.ticker}
                </Link>{" "}
                <span
                  className={
                    summary.bestToday.pct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {summary.bestToday.pct >= 0 ? "+" : ""}
                  {summary.bestToday.pct.toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </>
      )}
    </BriefingCard>
  );
}

type Summary = {
  openCount: number;
  totalPnl: number | null;
  bestToday: { ticker: string; pct: number } | null;
};

function computeSummary(
  trades: PaperTrade[] | null,
  quotes: Record<string, Quote | null>,
): Summary {
  if (!trades || trades.length === 0) {
    return { openCount: 0, totalPnl: 0, bestToday: null };
  }
  const open = trades.filter((t) => !t.closedAt);
  let pnl = 0;
  let pnlReady = open.length === 0;
  let best: { ticker: string; pct: number } | null = null;
  for (const trade of trades) {
    const livePrice = quotes[trade.ticker]?.price ?? null;
    const v = tradePnL(trade, livePrice);
    if (v !== null) {
      pnl += v;
      if (effectivePrice(trade, livePrice) !== null) pnlReady = true;
    }
    if (!trade.closedAt) {
      const q = quotes[trade.ticker];
      if (q?.previousClose && q.previousClose > 0) {
        const pct = ((q.price - q.previousClose) / q.previousClose) * 100;
        if (!best || pct > best.pct) {
          best = { ticker: trade.ticker, pct };
        }
      }
    }
  }
  return {
    openCount: open.length,
    totalPnl: pnlReady ? pnl : null,
    bestToday: best,
  };
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-3 w-44 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}

export function BriefingCard({
  title,
  linkHref,
  children,
}: {
  title: string;
  linkHref?: string;
  children: React.ReactNode;
}) {
  const titleEl = linkHref ? (
    <Link
      href={linkHref}
      className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-emerald-700 dark:text-neutral-400 dark:hover:text-emerald-300"
    >
      {title}
    </Link>
  ) : (
    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      {title}
    </span>
  );
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div>{titleEl}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
