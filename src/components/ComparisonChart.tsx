"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend as RechartsLegend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint, HistoryRange } from "@/lib/tickerHistory";

const RANGE_LABEL: Record<HistoryRange, string> = {
  "1mo": "1M",
  "3mo": "3M",
  "1y": "1Y",
};

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1mo": 31,
  "3mo": 93,
  "1y": 366,
};

const COLOR_A = "#10b981";
const COLOR_B = "#f97316";

type MergedPoint = {
  timestamp: number;
  date: string;
  aIndex?: number;
  bIndex?: number;
  aClose?: number;
  bClose?: number;
};

function sliceByRange(
  history: HistoryPoint[],
  range: HistoryRange,
): HistoryPoint[] {
  if (history.length === 0) return [];
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return history.filter((p) => p.timestamp >= cutoff);
}

function buildMergedSeries(
  tickerA: string,
  tickerB: string,
  historyA: HistoryPoint[],
  historyB: HistoryPoint[],
  range: HistoryRange,
): MergedPoint[] {
  const slicedA = sliceByRange(historyA, range);
  const slicedB = sliceByRange(historyB, range);
  if (slicedA.length === 0 && slicedB.length === 0) return [];

  const baselineA = slicedA[0]?.close;
  const baselineB = slicedB[0]?.close;

  const byDate = new Map<string, MergedPoint>();
  for (const p of slicedA) {
    const indexed =
      baselineA && baselineA > 0 ? (p.close / baselineA) * 100 : undefined;
    byDate.set(p.date, {
      timestamp: p.timestamp,
      date: p.date,
      aIndex: indexed,
      aClose: p.close,
    });
  }
  for (const p of slicedB) {
    const indexed =
      baselineB && baselineB > 0 ? (p.close / baselineB) * 100 : undefined;
    const existing = byDate.get(p.date);
    if (existing) {
      existing.bIndex = indexed;
      existing.bClose = p.close;
    } else {
      byDate.set(p.date, {
        timestamp: p.timestamp,
        date: p.date,
        bIndex: indexed,
        bClose: p.close,
      });
    }
  }
  return Array.from(byDate.values()).sort((x, y) => x.timestamp - y.timestamp);
}

export default function ComparisonChart({
  tickerA,
  tickerB,
  historyA,
  historyB,
}: {
  tickerA: string;
  tickerB: string;
  historyA: HistoryPoint[];
  historyB: HistoryPoint[];
}) {
  const [range, setRange] = useState<HistoryRange>("3mo");

  const data = useMemo(
    () => buildMergedSeries(tickerA, tickerB, historyA, historyB, range),
    [tickerA, tickerB, historyA, historyB, range],
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Normalized price (start = 100)
        </h2>
        <PeriodSelector range={range} onChange={setRange} />
      </div>

      <div className="h-80 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No price history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
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
                tickFormatter={(v: number) => v.toFixed(0)}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-neutral-500 dark:text-neutral-400"
                stroke="currentColor"
                width={50}
              />
              <Tooltip
                content={
                  <CompareTooltip tickerA={tickerA} tickerB={tickerB} />
                }
              />
              <RechartsLegend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => {
                  if (value === "aIndex") return tickerA;
                  if (value === "bIndex") return tickerB;
                  return value;
                }}
              />
              <Line
                type="monotone"
                dataKey="aIndex"
                name={tickerA}
                stroke={COLOR_A}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bIndex"
                name={tickerB}
                stroke={COLOR_B}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
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

function CompareTooltip({
  active,
  payload,
  tickerA,
  tickerB,
}: {
  active?: boolean;
  payload?: Array<{ payload: MergedPoint }>;
  tickerA: string;
  tickerB: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium">{point.date}</div>
      {point.aIndex !== undefined && (
        <div className="font-mono text-neutral-700 dark:text-neutral-300">
          <span style={{ color: COLOR_A }}>●</span> {tickerA}{" "}
          {point.aIndex.toFixed(2)}
          {point.aClose !== undefined && (
            <span className="text-neutral-500 dark:text-neutral-400"> (${point.aClose.toFixed(2)})</span>
          )}
        </div>
      )}
      {point.bIndex !== undefined && (
        <div className="font-mono text-neutral-700 dark:text-neutral-300">
          <span style={{ color: COLOR_B }}>●</span> {tickerB}{" "}
          {point.bIndex.toFixed(2)}
          {point.bClose !== undefined && (
            <span className="text-neutral-500 dark:text-neutral-400"> (${point.bClose.toFixed(2)})</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateTick(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
