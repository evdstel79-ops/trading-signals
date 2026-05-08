"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  ticker: string;
  /** Disambiguates rows where the same ticker appears for multiple trades. */
  label: string;
  returnPct: number;
};

const POSITIVE = "#10b981";
const NEGATIVE = "#ef4444";

export default function MoversChart({
  gainers,
  losers,
}: {
  gainers: Array<{ ticker: string; returnPct: number; txDate: string }>;
  losers: Array<{ ticker: string; returnPct: number; txDate: string }>;
}) {
  const data: Row[] = [
    ...losers.map((t, i) => ({
      ticker: t.ticker,
      label: makeLabel(t.ticker, t.txDate, gainers, losers, i, "loser"),
      returnPct: t.returnPct,
    })),
    ...gainers
      .slice()
      .reverse()
      .map((t, i) => ({
        ticker: t.ticker,
        label: makeLabel(t.ticker, t.txDate, gainers, losers, i, "gainer"),
        returnPct: t.returnPct,
      })),
  ];

  const maxAbs = data.reduce(
    (m, r) => Math.max(m, Math.abs(r.returnPct)),
    0,
  );
  const domainMax = maxAbs > 0 ? Math.ceil(maxAbs / 5) * 5 : 5;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-semibold">
        Return distribution of political buy trades
      </h2>
      <div
        className="w-full"
        style={{ height: Math.max(260, data.length * 22) }}
      >
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No backtested trades.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                domain={[-domainMax, domainMax]}
                tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v}%`}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-neutral-500 dark:text-neutral-400"
                stroke="currentColor"
              />
              <YAxis
                type="category"
                dataKey="label"
                width={90}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-neutral-500 dark:text-neutral-400"
                stroke="currentColor"
                interval={0}
              />
              <ReferenceLine
                x={0}
                stroke="currentColor"
                className="text-neutral-400 dark:text-neutral-600"
              />
              <Tooltip content={<MoversTooltip />} />
              <Bar dataKey="returnPct" isAnimationActive={false}>
                {data.map((row) => (
                  <Cell
                    key={row.label}
                    fill={row.returnPct >= 0 ? POSITIVE : NEGATIVE}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MoversTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const tone =
    row.returnPct >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-mono font-semibold">{row.ticker}</div>
      <div className={`font-mono ${tone}`}>
        {row.returnPct >= 0 ? "+" : ""}
        {row.returnPct.toFixed(2)}%
      </div>
    </div>
  );
}

function makeLabel(
  ticker: string,
  txDate: string,
  gainers: Array<{ ticker: string }>,
  losers: Array<{ ticker: string }>,
  index: number,
  bucket: "gainer" | "loser",
): string {
  // Same ticker can appear in both buckets via different trades; recharts
  // requires unique category keys, so suffix the date once we detect a clash.
  const allTickers = [
    ...gainers.map((g) => g.ticker),
    ...losers.map((l) => l.ticker),
  ];
  const occurrences = allTickers.filter((t) => t === ticker).length;
  if (occurrences <= 1) return ticker;
  return `${ticker} · ${txDate.slice(5)}${bucket === "loser" ? " ↓" : " ↑"}${index}`;
}
