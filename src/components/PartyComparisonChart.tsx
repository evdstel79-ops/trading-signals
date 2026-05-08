"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const REPUBLICAN_RED = "#dc2626";
const DEMOCRAT_BLUE = "#2563eb";

const SECTOR_PALETTE = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
];

export type ComparisonMetric = {
  label: string;
  rValue: number;
  dValue: number;
  /** How the bar value should be rendered (e.g. "%" or raw number). */
  format?: "number" | "percent";
};

export type SectorRow = Record<string, number | string> & {
  party: string;
};

export default function PartyComparisonChart({
  metrics,
  sectorData,
  sectors,
}: {
  metrics: ComparisonMetric[];
  /** Each row is { party: 'Republicans' | 'Democrats', [sectorName]: count }. */
  sectorData: SectorRow[];
  /** Sector keys in the order they should be stacked (top→bottom in legend). */
  sectors: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold">Side-by-side metrics</h2>
        <div className="space-y-3">
          {metrics.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold">
          Sector allocation (buy trades, top {sectors.length})
        </h2>
        <div className="h-56 w-full">
          {sectors.length === 0 || sectorData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              No sector data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectorData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
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
                  dataKey="party"
                  width={90}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-neutral-500"
                  stroke="currentColor"
                />
                <Tooltip content={<SectorTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {sectors.map((sector, i) => (
                  <Bar
                    key={sector}
                    dataKey={sector}
                    stackId="a"
                    fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: ComparisonMetric }) {
  const max = Math.max(metric.rValue, metric.dValue, 1);
  const rPct = (metric.rValue / max) * 100;
  const dPct = (metric.dValue / max) * 100;

  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {metric.label}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-end">
          <div className="relative h-4 w-full overflow-hidden rounded-l bg-neutral-100 dark:bg-neutral-800">
            <div
              className="absolute right-0 top-0 h-full"
              style={{
                width: `${rPct}%`,
                backgroundColor: REPUBLICAN_RED,
              }}
            />
            <span className="absolute inset-0 flex items-center pr-1.5 text-[10px] font-mono font-semibold text-white mix-blend-difference">
              <span className="ml-auto">
                {formatValue(metric.rValue, metric.format)}
              </span>
            </span>
          </div>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-600">
          vs
        </div>
        <div>
          <div className="relative h-4 w-full overflow-hidden rounded-r bg-neutral-100 dark:bg-neutral-800">
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                width: `${dPct}%`,
                backgroundColor: DEMOCRAT_BLUE,
              }}
            />
            <span className="absolute inset-0 flex items-center pl-1.5 text-[10px] font-mono font-semibold text-white mix-blend-difference">
              {formatValue(metric.dValue, metric.format)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectorTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload]
    .filter((p) => typeof p.value === "number" && p.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-0.5 font-medium">{label}</div>
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

function formatValue(value: number, format?: "number" | "percent"): string {
  if (format === "percent") return `${value.toFixed(0)}%`;
  return value.toLocaleString("en-US");
}
