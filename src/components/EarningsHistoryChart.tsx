"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EarningsHistoryEntry } from "@/lib/tickerFinancials";

type Row = {
  label: string;
  date: string;
  estimate: number | null;
  actual: number | null;
  surprisePct: number | null;
};

const ESTIMATE_COLOR = "#a3a3a3";
const ACTUAL_BEAT = "#10b981";
const ACTUAL_MISS = "#ef4444";
const ACTUAL_NEUTRAL = "#6b7280";

export default function EarningsHistoryChart({
  history,
}: {
  history: EarningsHistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No earnings history available.
      </div>
    );
  }

  const data: Row[] = history.map((h) => ({
    label: quarterLabel(h.date),
    date: h.date,
    estimate: h.epsEstimate,
    actual: h.epsActual,
    surprisePct: h.surprisePct,
  }));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-3 text-sm font-semibold">
        Earnings history (last {history.length} quarter
        {history.length === 1 ? "" : "s"})
      </h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
            barGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-neutral-200 dark:text-neutral-800"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-500 dark:text-neutral-400"
              stroke="currentColor"
            />
            <YAxis
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-500 dark:text-neutral-400"
              stroke="currentColor"
              width={50}
            />
            <Tooltip content={<EarningsTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) =>
                value === "estimate" ? "Estimate" : "Actual"
              }
            />
            <Bar
              dataKey="estimate"
              fill={ESTIMATE_COLOR}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              {data.map((row, i) => (
                <Cell key={i} fill={actualColor(row)} />
              ))}
              <LabelList
                dataKey="surprisePct"
                position="top"
                content={(props) => {
                  const { x, y, width, value } = props as {
                    x?: number;
                    y?: number;
                    width?: number;
                    value?: number | null;
                  };
                  if (
                    value === null ||
                    value === undefined ||
                    typeof x !== "number" ||
                    typeof y !== "number" ||
                    typeof width !== "number"
                  ) {
                    return null;
                  }
                  const sign = value >= 0 ? "+" : "";
                  const tone =
                    value >= 0
                      ? "fill-emerald-600 dark:fill-emerald-400"
                      : "fill-red-600 dark:fill-red-400";
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={10}
                      className={tone}
                    >
                      {sign}
                      {value.toFixed(1)}%
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EarningsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium">{row.label}</div>
      <div className="font-mono text-neutral-700 dark:text-neutral-300">
        Estimate{" "}
        {row.estimate !== null ? `$${row.estimate.toFixed(2)}` : "—"}
      </div>
      <div className="font-mono text-neutral-700 dark:text-neutral-300">
        Actual {row.actual !== null ? `$${row.actual.toFixed(2)}` : "—"}
      </div>
      {row.surprisePct !== null && (
        <div
          className={
            row.surprisePct >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {row.surprisePct >= 0 ? "+" : ""}
          {row.surprisePct.toFixed(1)}% surprise
        </div>
      )}
    </div>
  );
}

function actualColor(row: Row): string {
  if (
    row.actual === null ||
    row.estimate === null ||
    Math.abs(row.actual - row.estimate) < 0.005
  ) {
    return ACTUAL_NEUTRAL;
  }
  return row.actual > row.estimate ? ACTUAL_BEAT : ACTUAL_MISS;
}

function quarterLabel(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const month = d.getUTCMonth() + 1;
  const quarter =
    month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
  return `${quarter} '${String(d.getUTCFullYear()).slice(-2)}`;
}
