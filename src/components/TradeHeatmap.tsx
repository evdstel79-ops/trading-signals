"use client";

import { useMemo, useState } from "react";

export type HeatmapTrade = {
  /** YYYY-MM-DD or any date string parseable by Date(). */
  date: string;
  ticker?: string;
};

type Cell = {
  date: string;
  count: number;
  topTicker: string | null;
};

type WeekColumn = {
  weekStart: Date;
  days: Cell[];
};

const WEEKS_DEFAULT = 26;
const TRADING_DAYS = 5;
const DAY_LETTERS = ["M", "T", "W", "T", "F"];

export default function TradeHeatmap({
  trades,
  weeks = WEEKS_DEFAULT,
  compact = false,
}: {
  trades: HeatmapTrade[];
  weeks?: number;
  compact?: boolean;
}) {
  const cellSize = compact ? 10 : 14;
  const gap = 2;
  const cellPitch = cellSize + gap;
  const labelLeft = compact ? 14 : 18;
  const labelTop = compact ? 12 : 14;
  const legendCellSize = compact ? 9 : 11;

  const aggregates = useMemo(() => buildAggregates(trades), [trades]);
  const grid = useMemo(
    () => buildGrid(aggregates, weeks),
    [aggregates, weeks],
  );

  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    let prevMonth = -1;
    for (let w = 0; w < grid.length; w++) {
      const month = grid[w].weekStart.getUTCMonth();
      if (month !== prevMonth) {
        labels.push({
          x: w * cellPitch,
          label: grid[w].weekStart.toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
          }),
        });
        prevMonth = month;
      }
    }
    return labels;
  }, [grid, cellPitch]);

  const gridWidth = grid.length * cellPitch - gap;
  const gridHeight = TRADING_DAYS * cellPitch - gap;
  const svgWidth = labelLeft + gridWidth;
  const svgHeight = labelTop + gridHeight + 4;

  const [hovered, setHovered] = useState<
    | (Cell & {
        x: number;
        y: number;
      })
    | null
  >(null);

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block"
          role="img"
          aria-label={`Trading activity heatmap, last ${weeks} weeks`}
        >
          {monthLabels.map((m, i) => (
            <text
              key={`m-${i}`}
              x={labelLeft + m.x}
              y={labelTop - 3}
              fontSize={compact ? 8 : 9}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {m.label}
            </text>
          ))}

          {[0, 2, 4].map((d) => (
            <text
              key={`d-${d}`}
              x={0}
              y={labelTop + d * cellPitch + cellSize - 2}
              fontSize={compact ? 8 : 9}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {DAY_LETTERS[d]}
            </text>
          ))}

          {grid.map((col, w) =>
            col.days.map((cell, d) => {
              const x = labelLeft + w * cellPitch;
              const y = labelTop + d * cellPitch;
              return (
                <rect
                  key={`${w}-${d}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  className={`${colorClass(cell.count)} cursor-pointer`}
                  onPointerEnter={() => setHovered({ ...cell, x, y })}
                  onPointerLeave={() => setHovered(null)}
                />
              );
            }),
          )}
        </svg>
      </div>

      {hovered && (
        <HeatmapTooltip
          hovered={hovered}
          cellSize={cellSize}
          containerWidth={svgWidth}
        />
      )}

      <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
        <span>Less</span>
        {LEGEND_LEVELS.map((cls, i) => (
          <span
            key={i}
            className={`inline-block ${cls} rounded-[2px]`}
            style={{ width: legendCellSize, height: legendCellSize }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function HeatmapTooltip({
  hovered,
  cellSize,
  containerWidth,
}: {
  hovered: Cell & { x: number; y: number };
  cellSize: number;
  containerWidth: number;
}) {
  const tooltipMaxWidth = 200;
  // Anchor centered above the cell, but clamp to the container so it doesn't clip.
  const anchorX = hovered.x + cellSize / 2;
  const left = Math.max(
    8,
    Math.min(containerWidth - tooltipMaxWidth - 8, anchorX - tooltipMaxWidth / 2),
  );
  const top = Math.max(0, hovered.y - 56);

  const formattedDate = new Date(hovered.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left, top, maxWidth: tooltipMaxWidth }}
    >
      <div className="font-medium">{formattedDate}</div>
      <div className="text-neutral-700 dark:text-neutral-300">
        {hovered.count === 0
          ? "No trades"
          : `${hovered.count} trade${hovered.count === 1 ? "" : "s"}`}
        {hovered.topTicker && (
          <>
            {" · top "}
            <span className="font-mono">{hovered.topTicker}</span>
          </>
        )}
      </div>
    </div>
  );
}

const LEGEND_LEVELS = [
  "bg-neutral-200 dark:bg-neutral-800",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-600 dark:bg-emerald-500",
];

function colorClass(count: number): string {
  if (count === 0) return "fill-neutral-200 dark:fill-neutral-800";
  if (count <= 2) return "fill-emerald-200 dark:fill-emerald-900";
  if (count <= 5) return "fill-emerald-400 dark:fill-emerald-700";
  return "fill-emerald-600 dark:fill-emerald-500";
}

function buildAggregates(
  trades: HeatmapTrade[],
): Map<string, { count: number; tickers: Map<string, number> }> {
  const map = new Map<
    string,
    { count: number; tickers: Map<string, number> }
  >();
  for (const t of trades) {
    if (!t.date) continue;
    const date = t.date.slice(0, 10);
    let entry = map.get(date);
    if (!entry) {
      entry = { count: 0, tickers: new Map() };
      map.set(date, entry);
    }
    entry.count++;
    if (t.ticker) {
      entry.tickers.set(t.ticker, (entry.tickers.get(t.ticker) ?? 0) + 1);
    }
  }
  return map;
}

function buildGrid(
  aggregates: Map<string, { count: number; tickers: Map<string, number> }>,
  weeks: number,
): WeekColumn[] {
  const today = new Date();
  const currentMonday = mondayOf(today);
  const startMonday = new Date(currentMonday);
  startMonday.setUTCDate(currentMonday.getUTCDate() - (weeks - 1) * 7);

  const cols: WeekColumn[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(startMonday);
    weekStart.setUTCDate(startMonday.getUTCDate() + w * 7);
    const days: Cell[] = [];
    for (let d = 0; d < TRADING_DAYS; d++) {
      const day = new Date(weekStart);
      day.setUTCDate(weekStart.getUTCDate() + d);
      const key = day.toISOString().slice(0, 10);
      const ag = aggregates.get(key);
      days.push({
        date: key,
        count: ag?.count ?? 0,
        topTicker: ag ? topKey(ag.tickers) : null,
      });
    }
    cols.push({ weekStart, days });
  }
  return cols;
}

function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function topKey(m: Map<string, number>): string | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of m) {
    if (!best || count > best.count) best = { key, count };
  }
  return best?.key ?? null;
}
