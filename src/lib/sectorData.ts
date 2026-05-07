"use client";

import { useEffect, useState } from "react";

type QuotesResponse = {
  quotes: Record<string, { sector?: string | null } | null>;
};

// Module-level caches: persist across components for the lifetime of the tab.
const sectorCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function getSector(ticker: string): Promise<string | null> {
  if (!ticker) return null;
  const key = ticker.trim().toUpperCase();
  if (sectorCache.has(key)) return sectorCache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/quotes?tickers=${encodeURIComponent(key)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as QuotesResponse;
      return data.quotes?.[key]?.sector ?? null;
    } catch {
      return null;
    }
  })();
  inflight.set(key, promise);
  const sector = await promise;
  inflight.delete(key);
  sectorCache.set(key, sector);
  return sector;
}

export async function getSectorsBatch(
  tickers: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const needed: string[] = [];
  for (const raw of tickers) {
    if (!raw) continue;
    const key = raw.trim().toUpperCase();
    if (!key || result.has(key)) continue;
    if (sectorCache.has(key)) {
      result.set(key, sectorCache.get(key) ?? null);
    } else {
      needed.push(key);
    }
  }
  if (needed.length === 0) return result;

  try {
    const res = await fetch(
      `/api/quotes?tickers=${encodeURIComponent(needed.join(","))}`,
    );
    if (res.ok) {
      const data = (await res.json()) as QuotesResponse;
      for (const t of needed) {
        const sector = data.quotes?.[t]?.sector ?? null;
        sectorCache.set(t, sector);
        result.set(t, sector);
      }
    } else {
      for (const t of needed) result.set(t, null);
    }
  } catch {
    for (const t of needed) result.set(t, null);
  }
  return result;
}

/**
 * Hook that resolves sectors for a list of tickers.
 *
 * @param tickers - Tickers to look up. Re-keyed internally so passing a freshly
 *   sorted+uppercased list each render won't refetch unless the set changes.
 * @returns A map of ticker → sector (string or null) and a loading flag.
 */
export function useSectors(tickers: string[]): {
  sectors: Map<string, string | null>;
  loading: boolean;
} {
  const stableKey = Array.from(
    new Set(tickers.map((t) => t.toUpperCase()).filter(Boolean)),
  )
    .sort()
    .join(",");

  const [sectors, setSectors] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stableKey) {
      setSectors(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSectorsBatch(stableKey.split(",")).then((map) => {
      if (cancelled) return;
      setSectors(map);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [stableKey]);

  return { sectors, loading };
}
