"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SectorTotal = {
  sector: string;
  buyCount: number;
  sellCount: number;
  totalTrades: number;
};

export type SectorWeekly = {
  sector: string;
  points: { week: string; buyCount: number; sellCount: number }[];
};

type Period = "30d" | "90d" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  "30d": "30D",
  "90d": "90D",
  all: "All",
};

const PERIOD_DAYS: Record<Period, number | null> = {
  "30d": 30,
  "90d": 90,
  all: null,
};

// Visually-distinct palette for the line chart. Cycles if there are more
// sectors than colors, but we cap visible sectors below to avoid that.
const PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#ec4899", // pink
];

const LINE_SECTOR_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function SectorRotationChart({
  totals,
  weekly,
}: {
  totals: SectorTotal[];
  weekly: SectorWeekly[];
}) {
  const [period, setPeriod] = useState<Period>("90d");

  const visibleSectors = useMemo(() => {
    return [...totals]
      .sort((a, b) => b.totalTrades - a.totalTrades)
      .slice(0, LINE_SECTOR_LIMIT)
      .map((t) => t.sector);
  }, [totals]);

  const lineData = useMemo(() => {
    return buildLineSeries(weekly, visibleSectors, period);
  }, [weekly, visibleSectors, period]);

  const barData = useMemo(
    () =>
      [...totals]
        .filter((t) => t.totalTrades > 0)
        .sort((a, b) => a.totalTrades - b.totalTrades),
    [totals],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold">
          Trades per sector (buy / sell)
        </h2>
        <div className="w-full" style={{ height: Math.max(220, barData.length * 28) }}>
          {barData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              No sector data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-neutral-500"
                  stroke="currentColor"
                />
                <YAxis
                  type="category"
                  dataKey="sector"
                  width={130}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-neutral-500"
                  stroke="currentColor"
                />
                <Tooltip content={<BarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) =>
                    value === "buyCount" ? "Buys" : "Sells"
                  }
                />
                <Bar dataKey="buyCount" stackId="a" fill="#10b981" />
                <Bar dataKey="sellCount" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Trades per sector over time (top {visibleSectors.length})
          </h2>
          <PeriodSelector period={period} onChange={setPeriod} />
        </div>
        <div className="h-80 w-full">
          {lineData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              No data in this window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={lineData}
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
                  tickFormatter={formatWeekTick}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-neutral-500"
                  stroke="currentColor"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-neutral-500"
                  stroke="currentColor"
                  width={40}
                />
                <Tooltip content={<LineTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {visibleSectors.map((sector, i) => (
                  <Line
                    key={sector}
                    type="monotone"
                    dataKey={sector}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
      {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
        const active = period === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`min-h-[44px] border-r border-neutral-200 px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0 dark:border-neutral-700 lg:min-h-0 ${
              active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

function buildLineSeries(
  weekly: SectorWeekly[],
  sectors: string[],
  period: Period,
): Array<Record<string, number | string> & { week: string; timestamp: number }> {
  const cutoff =
    PERIOD_DAYS[period] === null
      ? -Infinity
      : Date.now() - PERIOD_DAYS[period]! * DAY_MS;

  const sectorSet = new Set(sectors);
  const byWeek = new Map<string, Record<string, number>>();

  for (const series of weekly) {
    if (!sectorSet.has(series.sector)) continue;
    for (const point of series.points) {
      const ts = Date.parse(point.week);
      if (!Number.isFinite(ts)) continue;
      if (ts < cutoff) continue;
      let bucket = byWeek.get(point.week);
      if (!bucket) {
        bucket = {};
        byWeek.set(point.week, bucket);
      }
      bucket[series.sector] = point.buyCount + point.sellCount;
    }
  }

  return Array.from(byWeek.entries())
    .map(([week, counts]) => ({
      week,
      timestamp: Date.parse(week),
      ...counts,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function formatWeekTick(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const buys =
    payload.find((p) => p.dataKey === "buyCount")?.value ?? 0;
  const sells =
    payload.find((p) => p.dataKey === "sellCount")?.value ?? 0;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium">{label}</div>
      <div className="font-mono text-emerald-600 dark:text-emerald-400">
        Buys {buys}
      </div>
      <div className="font-mono text-red-600 dark:text-red-400">
        Sells {sells}
      </div>
    </div>
  );
}

function LineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    payload: { week: string };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const week = payload[0].payload.week;
  const sorted = [...payload]
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-0.5 font-medium">Week of {week}</div>
      {sorted.map((p) => (
        <div
          key={p.name}
          className="flex items-baseline gap-2 font-mono text-neutral-700 dark:text-neutral-300"
        >
          <span style={{ color: p.color }}>●</span>
          <span className="flex-1 truncate">{p.name}</span>
          <span>{p.value}</span>
        </div>
      ))}
    </div>
  );
}
