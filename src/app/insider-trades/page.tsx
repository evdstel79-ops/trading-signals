"use client";

import { useEffect, useMemo, useState } from "react";
import type { InsiderTrade } from "@/app/api/insider-trades/route";
import TradeModal from "@/components/TradeModal";
import type { PaperTradeDirection } from "@/lib/paperTrades";

type ApiResponse = { trades: InsiderTrade[] } | { error: string };
type Side = InsiderTrade["transactionType"];

type ModalSignal = { ticker: string; direction: PaperTradeDirection };

const numberFmt = new Intl.NumberFormat("en-US");
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function InsiderTradesPage() {
  const [trades, setTrades] = useState<InsiderTrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sides, setSides] = useState<Set<Side>>(new Set());
  const [modalSignal, setModalSignal] = useState<ModalSignal | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/insider-trades");
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok || "error" in data) {
          setError("error" in data ? data.error : `Request failed: ${res.status}`);
          return;
        }
        setTrades(data.trades);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load trades");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!trades) return null;
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (q) {
        const hay = `${t.companyName} ${t.ticker}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sides.size > 0 && !sides.has(t.transactionType)) return false;
      return true;
    });
  }, [trades, search, sides]);

  const filtersActive = search.length > 0 || sides.size > 0;

  function clearFilters() {
    setSearch("");
    setSides(new Set());
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          SEC Insider Trades
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Form 4 transactions filed by corporate officers, directors, and 10%
          owners. Source: SEC EDGAR.
        </p>
      </header>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or ticker…"
            className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500"
          />

          <ToggleGroup label="Side">
            <ToggleButton
              active={sides.has("buy")}
              onClick={() => toggle(sides, "buy", setSides)}
              color="emerald"
            >
              Buy
            </ToggleButton>
            <ToggleButton
              active={sides.has("sell")}
              onClick={() => toggle(sides, "sell", setSides)}
              color="red"
            >
              Sell
            </ToggleButton>
          </ToggleGroup>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
          )}
        </div>

        {trades && (
          <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Showing {filtered?.length ?? 0} of {trades.length} trades
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filed</th>
              <th className="px-4 py-3 font-medium">Insider</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Shares</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {loading && <LoadingRows cols={8} />}
            {!loading && error && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                    Failed to load insider trades
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {error}
                  </div>
                </td>
              </tr>
            )}
            {!loading && !error && filtered && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  {filtersActive
                    ? "No trades match the current filters."
                    : "No insider trades found in the selected period."}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filtered?.map((t, i) => (
                <tr
                  key={`${t.filingUrl}-${i}`}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {t.filedAt}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.insiderName}</td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {t.companyName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {t.ticker || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SideBadge side={t.transactionType} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.shares ? numberFmt.format(Math.round(t.shares)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.value ? currencyFmt.format(t.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TradeButton
                      ticker={t.ticker}
                      direction={
                        t.transactionType === "sell" ? "sell" : "buy"
                      }
                      onClick={(signal) => setModalSignal(signal)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalSignal && (
        <TradeModal
          ticker={modalSignal.ticker}
          direction={modalSignal.direction}
          source="insider"
          onClose={() => setModalSignal(null)}
        />
      )}
    </div>
  );
}

function TradeButton({
  ticker,
  direction,
  onClick,
}: {
  ticker: string;
  direction: PaperTradeDirection;
  onClick: (signal: ModalSignal) => void;
}) {
  if (!ticker) {
    return (
      <span className="text-xs text-neutral-400 dark:text-neutral-600">
        no ticker
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick({ ticker, direction })}
      className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
    >
      Trade
    </button>
  );
}

function toggle<T>(
  set: Set<T>,
  value: T,
  setter: (s: Set<T>) => void,
): void {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function ToggleGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
        {children}
      </div>
    </div>
  );
}

type ToggleColor = "emerald" | "red" | "neutral";

function ToggleButton({
  active,
  onClick,
  children,
  color = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: ToggleColor;
}) {
  const activeStyles: Record<ToggleColor, string> = {
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    neutral:
      "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  };
  const inactive =
    "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium border-r border-neutral-200 last:border-r-0 dark:border-neutral-700 transition-colors ${
        active ? activeStyles[color] : inactive
      }`}
    >
      {children}
    </button>
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
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {side}
    </span>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
