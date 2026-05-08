"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useNotifications } from "@/lib/notifications";
import {
  loadPaperTrades,
  tradePnL,
  type PaperTrade,
} from "@/lib/paperTrades";
import { useAlerts } from "@/lib/priceAlerts";
import { useWatchlist } from "@/lib/watchlist";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type Quote = { price: number; symbol: string };
type QuotesResponse = { quotes: Record<string, Quote | null> };

export default function PersonalSummaryCard() {
  const { items: watchlist, mounted: wlMounted } = useWatchlist();
  const { alerts, mounted: alertsMounted } = useAlerts();
  const { unreadCount, mounted: notifsMounted } = useNotifications();

  const [openTrades, setOpenTrades] = useState<PaperTrade[]>([]);
  const [pnl, setPnl] = useState<number | null>(null);
  const [pnlReady, setPnlReady] = useState(false);
  const [tradesMounted, setTradesMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let open: PaperTrade[];
      try {
        const all = await loadPaperTrades();
        if (cancelled) return;
        open = all.filter((t) => !t.closedAt);
      } catch {
        if (!cancelled) {
          setOpenTrades([]);
          setTradesMounted(true);
          setPnl(null);
          setPnlReady(true);
        }
        return;
      }
      setOpenTrades(open);
      setTradesMounted(true);

      if (open.length === 0) {
        setPnl(0);
        setPnlReady(true);
        return;
      }

      const tickers = Array.from(new Set(open.map((t) => t.ticker)));
      try {
        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (cancelled) return;
        const quotes = data.quotes ?? {};
        let total = 0;
        for (const trade of open) {
          const q = quotes[trade.ticker];
          const price = q?.price ?? null;
          const v = tradePnL(trade, price);
          if (v !== null) total += v;
        }
        setPnl(total);
      } catch {
        if (!cancelled) setPnl(null);
      } finally {
        if (!cancelled) setPnlReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeAlerts = alerts.filter((a) => !a.triggeredAt).length;
  const ready =
    wlMounted && alertsMounted && notifsMounted && tradesMounted;

  const pnlTone =
    pnl === null || pnl === 0
      ? "text-neutral-700 dark:text-neutral-300"
      : pnl > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Your activity</h2>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          local
        </span>
      </div>
      <dl className="space-y-2 text-sm">
        <Row
          label="Watchlist"
          href="/watchlist"
          value={
            ready ? `${watchlist.length} ticker${watchlist.length === 1 ? "" : "s"}` : "—"
          }
        />
        <Row
          label="Active alerts"
          href="/alerts"
          value={ready ? activeAlerts.toString() : "—"}
        />
        <Row
          label="Unread notifications"
          value={
            ready ? (
              <span className="inline-flex items-center gap-1.5">
                {unreadCount}
                {unreadCount > 0 && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Row
          label="Open positions"
          href="/paper-trading"
          value={ready ? openTrades.length.toString() : "—"}
        />
        <Row
          label="Open P&L"
          href="/paper-trading"
          value={
            !ready || !pnlReady ? (
              "—"
            ) : pnl === null ? (
              <span className="text-neutral-400 dark:text-neutral-600">
                unavailable
              </span>
            ) : (
              <span className={`font-medium ${pnlTone}`}>
                {pnl >= 0 ? "+" : ""}
                {currencyFmt.format(pnl)}
              </span>
            )
          }
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  const labelEl = href ? (
    <Link
      href={href}
      className="text-neutral-500 hover:text-emerald-700 hover:underline dark:text-neutral-400 dark:hover:text-emerald-300"
    >
      {label}
    </Link>
  ) : (
    <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
  );
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{labelEl}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
