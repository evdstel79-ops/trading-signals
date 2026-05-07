"use client";

import { useEffect, useMemo, useState } from "react";
import type { InsiderTrade } from "@/lib/insiderSignals";
import ExportButton from "@/components/ExportButton";
import TickerLink from "@/components/TickerLink";
import TradeModal from "@/components/TradeModal";
import WatchlistButton from "@/components/WatchlistButton";
import type { PaperTradeDirection } from "@/lib/paperTrades";
import { useSectors } from "@/lib/sectorData";
import { useWatchlist } from "@/lib/watchlist";

type ApiResponse = { trades: InsiderTrade[] } | { error: string };
type Side = InsiderTrade["transactionType"];

type ModalSignal = { ticker: string; direction: PaperTradeDirection };

type SortDir = "asc" | "desc";
type SortColId =
  | "filedAt"
  | "insiderName"
  | "companyName"
  | "ticker"
  | "transactionType"
  | "shares"
  | "value";

const SORTERS: Record<
  SortColId,
  { get: (t: InsiderTrade) => string | number; defaultDir: SortDir }
> = {
  filedAt: { get: (t) => t.filedAt, defaultDir: "desc" },
  insiderName: { get: (t) => t.insiderName.toLowerCase(), defaultDir: "asc" },
  companyName: { get: (t) => t.companyName.toLowerCase(), defaultDir: "asc" },
  ticker: { get: (t) => t.ticker, defaultDir: "asc" },
  transactionType: { get: (t) => t.transactionType, defaultDir: "asc" },
  shares: { get: (t) => t.shares, defaultDir: "desc" },
  value: { get: (t) => t.value, defaultDir: "desc" },
};

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
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [sides, setSides] = useState<Set<Side>>(new Set());
  const [sector, setSector] = useState<string>("");
  const [modalSignal, setModalSignal] = useState<ModalSignal | null>(null);
  const [sort, setSort] = useState<{ col: SortColId; dir: SortDir }>({
    col: "filedAt",
    dir: "desc",
  });
  const { isWatched, toggle: toggleWatch } = useWatchlist();

  async function load(isRefresh: boolean) {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/insider-trades", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : `Request failed: ${res.status}`);
        return;
      }
      setTrades(data.trades);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickerList = useMemo(
    () => trades?.map((t) => t.ticker).filter(Boolean) ?? [],
    [trades],
  );
  const { sectors } = useSectors(tickerList);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of sectors.values()) if (s) set.add(s);
    return Array.from(set).sort();
  }, [sectors]);

  const filtered = useMemo(() => {
    if (!trades) return null;
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (q) {
        const hay = `${t.companyName} ${t.ticker}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sides.size > 0 && !sides.has(t.transactionType)) return false;
      if (sector) {
        const s = sectors.get(t.ticker.toUpperCase()) ?? null;
        if (s !== sector) return false;
      }
      return true;
    });
  }, [trades, search, sides, sector, sectors]);

  const sorted = useMemo(() => {
    if (!filtered) return null;
    const get = SORTERS[sort.col].get;
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
  }, [filtered, sort]);

  function handleSort(col: SortColId) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: SORTERS[col].defaultDir },
    );
  }

  const filtersActive = search.length > 0 || sides.size > 0 || sector !== "";

  function clearFilters() {
    setSearch("");
    setSides(new Set());
    setSector("");
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

          <SectorSelect
            value={sector}
            onChange={setSector}
            options={availableSectors}
          />

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
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Showing {filtered?.length ?? 0} of {trades.length} trades
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                data={(sorted ?? []).map((t) => ({
                  filed_at: t.filedAt,
                  insider_name: t.insiderName,
                  company: t.companyName,
                  ticker: t.ticker,
                  side: t.transactionType,
                  shares: t.shares,
                  value_usd: t.value,
                  filing_url: t.filingUrl,
                }))}
                filename={`insider-trades-${new Date().toISOString().slice(0, 10)}.csv`}
              />
              <RefreshButton
                refreshing={refreshing}
                onClick={() => load(true)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <SortableTh col="filedAt" label="Filed" sort={sort} onSort={handleSort} />
              <SortableTh col="insiderName" label="Insider" sort={sort} onSort={handleSort} />
              <SortableTh col="companyName" label="Company" sort={sort} onSort={handleSort} />
              <SortableTh col="ticker" label="Ticker" sort={sort} onSort={handleSort} />
              <SortableTh col="transactionType" label="Side" sort={sort} onSort={handleSort} />
              <SortableTh col="shares" label="Shares" sort={sort} onSort={handleSort} align="right" />
              <SortableTh col="value" label="Value" sort={sort} onSort={handleSort} align="right" />
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
            {!loading && !error && sorted && sorted.length === 0 && (
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
              sorted?.map((t, i) => (
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
                    <TickerLink ticker={t.ticker} />
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
                    <div className="inline-flex items-center gap-1">
                      <WatchlistButton
                        ticker={t.ticker}
                        watched={isWatched(t.ticker)}
                        onToggle={toggleWatch}
                      />
                      <TradeButton
                        ticker={t.ticker}
                        direction={
                          t.transactionType === "sell" ? "sell" : "buy"
                        }
                        onClick={(signal) => setModalSignal(signal)}
                      />
                    </div>
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

function SectorSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Sector
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        <option value="">All sectors</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function RefreshButton({
  refreshing,
  onClick,
}: {
  refreshing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 lg:min-h-0"
      aria-label={refreshing ? "Refreshing" : "Refresh"}
    >
      <svg
        className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
      <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}

function SortableTh({
  col,
  label,
  sort,
  onSort,
  align = "left",
}: {
  col: SortColId;
  label: string;
  sort: { col: SortColId; dir: SortDir };
  onSort: (col: SortColId) => void;
  align?: "left" | "right";
}) {
  const active = sort.col === col;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-neutral-700 dark:hover:text-neutral-200 ${
          active ? "text-neutral-700 dark:text-neutral-200" : ""
        }`}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <span className="inline-block w-2 text-center text-[10px] leading-none">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
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
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 lg:min-h-0 lg:min-w-0"
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
