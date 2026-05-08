"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import TickerLink from "@/components/TickerLink";
import type { TickerEarnings } from "@/lib/earnings";
import { useWatchlist } from "@/lib/watchlist";

const epsFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

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

              {undated.length > 0 && (
                <UndatedSection items={undated} />
              )}
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

type WeekGroup = {
  weekStart: string;
  isCurrentWeek: boolean;
  items: TickerEarnings[];
};

function groupByWeek(earnings: TickerEarnings[]): WeekGroup[] {
  const now = Date.now();
  const today = new Date();
  const currentMonday = mondayOf(today);
  const cutoff = new Date(currentMonday);
  cutoff.setUTCDate(currentMonday.getUTCDate() - 7);

  const byWeek = new Map<string, TickerEarnings[]>();
  for (const item of earnings) {
    if (!item.earningsDate) continue;
    const ts = Date.parse(item.earningsDate);
    if (!Number.isFinite(ts)) continue;
    if (ts < cutoff.getTime() && ts < now) continue;

    const weekKey = mondayOf(new Date(ts)).toISOString().slice(0, 10);
    let arr = byWeek.get(weekKey);
    if (!arr) {
      arr = [];
      byWeek.set(weekKey, arr);
    }
    arr.push(item);
  }

  const currentMondayKey = currentMonday.toISOString().slice(0, 10);
  return Array.from(byWeek.entries())
    .map(([weekStart, items]) => ({
      weekStart,
      isCurrentWeek: weekStart === currentMondayKey,
      items: items.sort((a, b) =>
        a.earningsDate! < b.earningsDate!
          ? -1
          : a.earningsDate! > b.earningsDate!
            ? 1
            : 0,
      ),
    }))
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
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        {group.isCurrentWeek ? "This week" : `Week of ${formatDate(group.weekStart)}`}
        <span className="ml-2 text-[11px] font-normal text-neutral-500 dark:text-neutral-400">
          ({group.items.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <EarningsCard key={item.ticker} item={item} />
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

function EarningsCard({ item }: { item: TickerEarnings }) {
  const date = item.earningsDate ? new Date(item.earningsDate) : null;
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-base font-semibold">
          <TickerLink ticker={item.ticker} />
        </span>
        {item.companyName && (
          <span className="truncate text-sm text-neutral-600 dark:text-neutral-400">
            {item.companyName}
          </span>
        )}
        {item.timing !== "unknown" && <TimingBadge timing={item.timing} />}
        {item.epsEstimate !== null && (
          <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
            EPS est{" "}
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
              {epsFmt.format(item.epsEstimate)}
            </span>
          </span>
        )}
      </div>
      {date && (
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </div>
      )}
    </li>
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
          className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-baseline gap-3">
            <div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
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

