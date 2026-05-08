"use client";

import { useEffect, useMemo, useState } from "react";

import type { TickerEarnings } from "@/lib/earnings";
import { useWatchlist } from "@/lib/watchlist";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function EarningsQuickCount() {
  const { items, mounted } = useWatchlist();
  const [count, setCount] = useState<number | null>(null);

  const tickers = useMemo(
    () => Array.from(new Set(items.map((i) => i.ticker).filter(Boolean))),
    [items],
  );
  const tickerKey = useMemo(() => [...tickers].sort().join(","), [tickers]);

  useEffect(() => {
    if (!mounted) return;
    if (tickers.length === 0) {
      setCount(0);
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
        const cutoff = Date.now() + THIRTY_DAYS_MS;
        const now = Date.now();
        const upcoming = (data.earnings ?? []).filter((e) => {
          if (!e.earningsDate) return false;
          const ts = Date.parse(e.earningsDate);
          return Number.isFinite(ts) && ts >= now && ts <= cutoff;
        });
        setCount(upcoming.length);
      } catch {
        // Silent — quick-count is best-effort.
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tickerKey]);

  if (!mounted) return <span>—</span>;
  if (tickers.length === 0) return <span>Add tickers to your watchlist</span>;
  if (count === null) return <span>Checking…</span>;
  if (count === 0) return <span>None in the next 30 days</span>;
  return (
    <span>
      {count} upcoming in 30d
    </span>
  );
}
