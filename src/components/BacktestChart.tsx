"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SeriesPoint = { date: string; value: number };

export default function BacktestChart({ series }: { series: SeriesPoint[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No backtest data.
      </div>
    );
  }

  const data = series.map((p) => ({
    ...p,
    timestamp: Date.parse(p.date),
  }));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-semibold">
        Cumulative equal-weighted return (start = 100)
      </h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id="backtestFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              y={100}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-neutral-400 dark:text-neutral-600"
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#backtestFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { date: string; value: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium">{point.date}</div>
      <div className="font-mono text-neutral-700 dark:text-neutral-300">
        Index {point.value.toFixed(2)}{" "}
        <span
          className={
            point.value >= 100
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          ({point.value >= 100 ? "+" : ""}
          {(point.value - 100).toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function formatDateTick(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
