"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint, HistoryRange } from "@/lib/tickerHistory";

export type ChartTradeMarker = {
  /** YYYY-MM-DD */
  date: string;
  side: "buy" | "sell" | "other";
  source: "political" | "insider";
  label: string;
};

const RANGE_LABEL: Record<HistoryRange, string> = {
  "1mo": "1M",
  "3mo": "3M",
  "1y": "1Y",
};

export default function TickerChart({
  ticker,
  initialHistory,
  initialRange,
  trades,
}: {
  ticker: string;
  initialHistory: HistoryPoint[];
  initialRange: HistoryRange;
  trades: ChartTradeMarker[];
}) {
  const [range, setRange] = useState<HistoryRange>(initialRange);
  const [history, setHistory] = useState<HistoryPoint[]>(initialHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (range === initialRange) {
      setHistory(initialHistory);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/ticker-history?ticker=${encodeURIComponent(ticker)}&range=${range}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? `Request failed: ${res.status}`);
          return;
        }
        setHistory(data.history ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, ticker, initialHistory, initialRange]);

  const visibleTrades = useMemo(() => {
    if (history.length === 0) return [];
    const minTs = history[0].timestamp;
    const maxTs = history[history.length - 1].timestamp;
    return trades
      .map((t) => ({ ...t, ts: Date.parse(t.date) }))
      .filter(
        (t) => Number.isFinite(t.ts) && t.ts >= minTs && t.ts <= maxTs,
      );
  }, [trades, history]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <PeriodSelector range={range} onChange={setRange} />
        {loading && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Loading…
          </span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400" title={error}>
            Failed to load
          </span>
        )}
      </div>

      <div className="h-72 w-full">
        {history.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No price history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={history}
              margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-neutral-200 dark:text-neutral-800"
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatDateTick}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-neutral-500 dark:text-neutral-400"
                stroke="currentColor"
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-neutral-500 dark:text-neutral-400"
                stroke="currentColor"
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {visibleTrades.map((t, i) => (
                <ReferenceLine
                  key={`${t.date}-${i}`}
                  x={t.ts}
                  stroke={
                    t.side === "buy"
                      ? "#10b981"
                      : t.side === "sell"
                        ? "#ef4444"
                        : "#a3a3a3"
                  }
                  strokeDasharray="3 3"
                  strokeOpacity={0.7}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <Legend />
    </div>
  );
}

function PeriodSelector({
  range,
  onChange,
}: {
  range: HistoryRange;
  onChange: (r: HistoryRange) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
      {(Object.keys(RANGE_LABEL) as HistoryRange[]).map((r) => {
        const active = range === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`min-h-[44px] border-r border-neutral-200 px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0 dark:border-neutral-700 lg:min-h-0 ${
              active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 bg-emerald-500" />
        Close price
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-px border-l border-dashed border-emerald-500" />
        Buy
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-px border-l border-dashed border-red-500" />
        Sell
      </span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium">{point.date}</div>
      <div className="font-mono text-neutral-700 dark:text-neutral-300">
        ${point.close.toFixed(2)}
      </div>
    </div>
  );
}

function formatDateTick(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
