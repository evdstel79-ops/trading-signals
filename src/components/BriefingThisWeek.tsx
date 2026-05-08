"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BriefingCard } from "@/components/BriefingPortfolio";
import type { TickerEarnings } from "@/lib/earnings";
import { useAlerts } from "@/lib/priceAlerts";
import { useWatchlist } from "@/lib/watchlist";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NextMacro = {
  event: string;
  date: string;
  isFomc: boolean;
} | null;

export default function BriefingThisWeek({
  nextMacro,
}: {
  nextMacro: NextMacro;
}) {
  const { items: watchlist, mounted: watchlistMounted } = useWatchlist();
  const { alerts, mounted: alertsMounted } = useAlerts();
  const [earnings, setEarnings] = useState<TickerEarnings[] | null>(null);

  const tickers = useMemo(
    () => Array.from(new Set(watchlist.map((w) => w.ticker).filter(Boolean))),
    [watchlist],
  );
  const tickerKey = useMemo(() => [...tickers].sort().join(","), [tickers]);

  useEffect(() => {
    if (!watchlistMounted) return;
    if (tickers.length === 0) {
      setEarnings([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/earnings?tickers=${encodeURIComponent(tickers.join(","))}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { earnings?: TickerEarnings[] };
        if (controller.signal.aborted) return;
        setEarnings(data.earnings ?? []);
      } catch {
        // Soft-fail.
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistMounted, tickerKey]);

  const nextEarnings = useMemo(() => {
    if (!earnings || earnings.length === 0) return null;
    const now = Date.now();
    const sorted = earnings
      .filter((e) => e.earningsDate)
      .map((e) => ({ ...e, ts: Date.parse(e.earningsDate!) }))
      .filter((e) => Number.isFinite(e.ts) && e.ts >= now)
      .sort((a, b) => a.ts - b.ts);
    return sorted[0] ?? null;
  }, [earnings]);

  const activeAlerts = alerts.filter((a) => !a.triggeredAt).length;
  const ready = watchlistMounted && alertsMounted && earnings !== null;

  return (
    <BriefingCard title="This week">
      {!ready ? (
        <Skeleton />
      ) : (
        <div className="space-y-2 text-sm">
          <Row
            label="Next earnings"
            value={
              nextEarnings ? (
                <span className="font-mono">
                  <span className="font-semibold">{nextEarnings.ticker}</span>
                  <span className="ml-1.5 text-neutral-500 dark:text-neutral-400">
                    {formatCountdown(nextEarnings.ts)}
                  </span>
                </span>
              ) : (
                <span className="text-neutral-400 dark:text-neutral-600">
                  —
                </span>
              )
            }
            href={nextEarnings ? "/earnings" : undefined}
          />
          <Row
            label="Next macro"
            value={
              nextMacro ? (
                <span className="font-mono">
                  <span className="font-medium">
                    {shortenMacroName(nextMacro.event)}
                  </span>
                  <span className="ml-1.5 text-neutral-500 dark:text-neutral-400">
                    {formatCountdown(Date.parse(nextMacro.date))}
                  </span>
                </span>
              ) : (
                <span className="text-neutral-400 dark:text-neutral-600">
                  —
                </span>
              )
            }
            href={nextMacro ? "/macro" : undefined}
          />
          <Row
            label="Active alerts"
            value={
              <span className="font-mono">
                {activeAlerts}
                {activeAlerts > 0 && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                )}
              </span>
            }
            href={activeAlerts > 0 ? "/alerts" : undefined}
          />
        </div>
      )}
    </BriefingCard>
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  const labelEl = href ? (
    <Link
      href={href}
      className="text-neutral-500 hover:text-emerald-700 hover:underline dark:text-neutral-400 dark:hover:text-emerald-300"
    >
      {label}
    </Link>
  ) : (
    <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
  );
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span>{labelEl}</span>
      <span>{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"
        />
      ))}
    </div>
  );
}

function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.round(diff / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

function shortenMacroName(event: string): string {
  // Trim long suffixes for the small briefing card.
  if (event.length <= 26) return event;
  return event.slice(0, 24) + "…";
}
