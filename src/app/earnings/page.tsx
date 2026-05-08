"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import TickerLink from "@/components/TickerLink";
import type { TickerEarnings } from "@/lib/earnings";
import { useWatchlist } from "@/lib/watchlist";

const DAY_MS = 24 * 60 * 60 * 1000;

const epsFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const TICKER_PALETTE = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
];

type WeekStatus = "past" | "current" | "future";

type WeekGroup = {
  weekStart: string;
  status: WeekStatus;
  items: TickerEarnings[];
};

export default function EarningsPage() {
  const { items: watchlist, mounted } = useWatchlist();
  const [earnings, setEarnings] = useState<TickerEarnings[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickers = useMemo(
    () => Array.from(new Set(watchlist.map((w) => w.ticker).filter(Boolean))),
    [watchlist],
  );
  const tickerKey = useMemo(() => [...tickers].sort().join(","), [tickers]);

  useEffect(() => {
    if (!mounted) return;
    if (tickers.length === 0) {
      setEarnings([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/earnings?tickers=${encodeURIComponent(tickers.join(","))}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as {
          earnings?: TickerEarnings[];
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setEarnings(data.earnings ?? []);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load earnings");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tickerKey]);

  const groups = useMemo(() => groupByWeek(earnings), [earnings]);
  const undated = useMemo(
    () => earnings.filter((e) => !e.earningsDate),
    [earnings],
  );
  const summary = useMemo(() => buildSummary(earnings), [earnings]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Upcoming earnings calls for every ticker on your watchlist, grouped
          by week.
        </p>
      </header>

      {!mounted ? (
        <SkeletonState />
      ) : tickers.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryBar summary={summary} />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && earnings.length === 0 ? (
            <SkeletonState />
          ) : groups.length === 0 && undated.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              No upcoming earnings dates found for your watchlist.
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <WeekSection key={group.weekStart} group={group} />
              ))}

              {undated.length > 0 && <UndatedSection items={undated} />}
            </>
          )}

          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {earnings.length} ticker{earnings.length === 1 ? "" : "s"} checked
            {loading && earnings.length > 0 ? " · refreshing…" : ""}
          </div>
        </>
      )}
    </div>
  );
}

type Summary = {
  thisWeek: number;
  next30: number;
  next90: number;
};

function buildSummary(earnings: TickerEarnings[]): Summary {
  const now = Date.now();
  const today = new Date();
  const currentMonday = mondayOf(today).getTime();
  const nextMonday = currentMonday + 7 * DAY_MS;
  const day30 = now + 30 * DAY_MS;
  const day90 = now + 90 * DAY_MS;

  let thisWeek = 0;
  let next30 = 0;
  let next90 = 0;
  for (const e of earnings) {
    if (!e.earningsDate) continue;
    const ts = Date.parse(e.earningsDate);
    if (!Number.isFinite(ts)) continue;
    if (ts >= currentMonday && ts < nextMonday) thisWeek++;
    if (ts >= now && ts <= day30) next30++;
    if (ts >= now && ts <= day90) next90++;
  }
  return { thisWeek, next30, next90 };
}

function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-neutral-700 dark:text-neutral-300">
        <SummaryStat value={summary.thisWeek} label="this week" emphasis />
        <Sep />
        <SummaryStat value={summary.next30} label="in the next 30 days" />
        <Sep />
        <SummaryStat value={summary.next90} label="in the next 90 days" />
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  label,
  emphasis = false,
}: {
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  const numCls = emphasis
    ? "font-mono text-base font-semibold text-emerald-700 dark:text-emerald-300"
    : "font-mono font-semibold";
  return (
    <span>
      <span className={numCls}>{value}</span>{" "}
      <span className="text-neutral-500 dark:text-neutral-400">
        earning{value === 1 ? "" : "s"} {label}
      </span>
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-neutral-300 dark:text-neutral-700">
      ·
    </span>
  );
}

function groupByWeek(earnings: TickerEarnings[]): WeekGroup[] {
  const today = new Date();
  const currentMonday = mondayOf(today);
  const currentMondayKey = currentMonday.toISOString().slice(0, 10);
  const nextMonday = new Date(currentMonday);
  nextMonday.setUTCDate(currentMonday.getUTCDate() + 7);

  const byWeek = new Map<string, TickerEarnings[]>();
  for (const item of earnings) {
    if (!item.earningsDate) continue;
    const ts = Date.parse(item.earningsDate);
    if (!Number.isFinite(ts)) continue;
    const weekKey = mondayOf(new Date(ts)).toISOString().slice(0, 10);
    let arr = byWeek.get(weekKey);
    if (!arr) {
      arr = [];
      byWeek.set(weekKey, arr);
    }
    arr.push(item);
  }

  return Array.from(byWeek.entries())
    .map<WeekGroup>(([weekStart, items]) => {
      const status: WeekStatus =
        weekStart < currentMondayKey
          ? "past"
          : weekStart === currentMondayKey
            ? "current"
            : "future";
      return {
        weekStart,
        status,
        items: items.sort((a, b) =>
          a.earningsDate! < b.earningsDate!
            ? -1
            : a.earningsDate! > b.earningsDate!
              ? 1
              : 0,
        ),
      };
    })
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function WeekSection({ group }: { group: WeekGroup }) {
  const isCurrent = group.status === "current";
  const isPast = group.status === "past";
  const wrapperClass = isCurrent
    ? "rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
    : isPast
      ? "rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
      : "";

  const headingTone = isPast
    ? "text-neutral-400 dark:text-neutral-600"
    : isCurrent
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-neutral-700 dark:text-neutral-200";

  return (
    <section className={wrapperClass}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className={`text-sm font-semibold ${headingTone}`}>
          {isCurrent
            ? "This week"
            : `Week of ${formatDate(group.weekStart)}`}
        </h2>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          ({group.items.length})
        </span>
        {isPast && (
          <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            Past
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <EarningsCard
            key={item.ticker}
            item={item}
            tone={group.status}
          />
        ))}
      </ul>
    </section>
  );
}

function UndatedSection({ items }: { items: TickerEarnings[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
        No date available
        <span className="ml-2 text-[11px] font-normal">({items.length})</span>
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.ticker}
            className="flex items-baseline gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="font-mono text-sm font-semibold">
              <TickerLink ticker={item.ticker} />
            </span>
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {item.companyName ?? "No upcoming call scheduled"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EarningsCard({
  item,
  tone,
}: {
  item: TickerEarnings;
  tone: WeekStatus;
}) {
  const date = item.earningsDate ? new Date(item.earningsDate) : null;
  const muted = tone === "past";
  const cardClass = muted
    ? "rounded-lg border border-neutral-200 bg-white/40 px-4 py-3 opacity-70 dark:border-neutral-800 dark:bg-neutral-900/40"
    : tone === "current"
      ? "rounded-lg border border-emerald-200 bg-white px-4 py-3 dark:border-emerald-900 dark:bg-neutral-900"
      : "rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <li className={cardClass}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TickerBadge ticker={item.ticker} muted={muted} />
          <div className="min-w-0 flex-1">
            {item.companyName && (
              <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {item.companyName}
              </div>
            )}
            {date && (
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                  {date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">
                  ·
                </span>
                <span
                  className={
                    tone === "current"
                      ? "font-medium text-emerald-700 dark:text-emerald-300"
                      : muted
                        ? "text-neutral-400 dark:text-neutral-600"
                        : "text-neutral-600 dark:text-neutral-300"
                  }
                >
                  {formatCountdown(date)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {item.epsEstimate !== null ? (
            <div className="text-right">
              <div
                className={`font-mono text-lg font-semibold ${
                  muted
                    ? "text-neutral-500 dark:text-neutral-500"
                    : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                {epsFmt.format(item.epsEstimate)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                EPS est
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-600">
              No EPS estimate
            </span>
          )}
          {item.timing !== "unknown" && <TimingBadge timing={item.timing} />}
        </div>
      </div>
    </li>
  );
}

function TickerBadge({
  ticker,
  muted,
}: {
  ticker: string;
  muted: boolean;
}) {
  const palette = muted
    ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
    : tickerColor(ticker);
  return (
    <Link
      href={`/ticker/${encodeURIComponent(ticker)}`}
      className={`inline-flex h-12 w-16 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold tracking-tight transition-opacity hover:opacity-80 ${palette}`}
    >
      {ticker}
    </Link>
  );
}

function TimingBadge({ timing }: { timing: "BMO" | "AMC" }) {
  const styles =
    timing === "BMO"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300";
  return (
    <span
      title={timing === "BMO" ? "Before market open" : "After market close"}
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {timing}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center text-neutral-300 dark:text-neutral-600">
        <span className="text-3xl" aria-hidden>
          📅
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold">Your watchlist is empty</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Add tickers to your watchlist to see upcoming earnings here.{" "}
        <Link
          href="/watchlist"
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
        >
          Open watchlist →
        </Link>
      </p>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-16 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="h-7 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  }
  return TICKER_PALETTE[hash % TICKER_PALETTE.length];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCountdown(date: Date): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  const days = Math.round(diff / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) {
    if (days < 14) return `in ${days} days`;
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30)} months`;
  }
  const past = -days;
  if (past < 14) return `${past} days ago`;
  if (past < 60) return `${Math.round(past / 7)} weeks ago`;
  return `${Math.round(past / 30)} months ago`;
}
