"use client";

import { useCallback, useEffect, useState } from "react";

export type WatchlistItem = {
  ticker: string;
  addedAt: string;
};

const LEGACY_STORAGE_KEY = "trading-signals.watchlist.v1";
const MIGRATION_FLAG = "trading-signals.watchlist.migrated.v1";
const API_URL = "/api/watchlist";
const CACHE_TTL_MS = 30_000;

// Module-scoped cache shared across every useWatchlist() instance in the
// browser tab. Persists across Next.js client-side navigations, so repeat
// visits to /watchlist (or any page mounting WatchlistButton) within 30s
// don't refetch.
let cachedItems: WatchlistItem[] | null = null;
let cachedAt = 0;
let inFlightFetch: Promise<WatchlistItem[]> | null = null;

function isCacheFresh(): boolean {
  return cachedItems !== null && Date.now() - cachedAt < CACHE_TTL_MS;
}

function setCache(items: WatchlistItem[]): void {
  cachedItems = items;
  cachedAt = Date.now();
}

function bustCache(): void {
  cachedAt = 0;
}

async function getItemsCached(): Promise<WatchlistItem[]> {
  if (isCacheFresh() && cachedItems !== null) return cachedItems;
  if (inFlightFetch) return inFlightFetch;
  inFlightFetch = listWatchlist()
    .then((items) => {
      setCache(items);
      return items;
    })
    .finally(() => {
      inFlightFetch = null;
    });
  return inFlightFetch;
}

type ListResponse = { items: WatchlistItem[] } | { error: string };
type AddResponse = { item: WatchlistItem } | { error: string };
type DeleteResponse = { removed: number } | { error: string };

async function listWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  const data = (await res.json()) as ListResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.items;
}

async function addWatchlist(symbol: string): Promise<WatchlistItem> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  const data = (await res.json()) as AddResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.item;
}

async function removeWatchlist(symbol: string): Promise<void> {
  const res = await fetch(`${API_URL}?symbol=${encodeURIComponent(symbol)}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as DeleteResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
}

/**
 * One-shot move from the legacy localStorage key to Postgres. Best-effort:
 * partial failures still flip the flag so we don't keep retrying forever.
 */
async function migrateLegacyToApi(): Promise<void> {
  if (typeof window === "undefined") return;
  let store: Storage;
  try {
    store = window.localStorage;
  } catch {
    return;
  }
  if (store.getItem(MIGRATION_FLAG) === "1") return;

  const raw = store.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }
  if (!Array.isArray(parsed)) {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const ticker = (entry as { ticker?: unknown }).ticker;
    if (typeof ticker !== "string") continue;
    try {
      await addWatchlist(ticker);
    } catch {
      // Skip the bad row; others may still go through.
    }
  }

  try {
    store.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
  store.setItem(MIGRATION_FLAG, "1");
}

export type WatchlistState = {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addToWatchlist: (symbol: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  isInWatchlist: (symbol: string) => boolean;

  // Backward-compatible aliases for existing call sites:
  toggle: (symbol: string) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  isWatched: (symbol: string) => boolean;
  /** True once the initial fetch has resolved (success or failure). */
  mounted: boolean;
};

export function useWatchlist(): WatchlistState {
  // Lazy initializers read the module cache so navigations within the TTL
  // get instant first-paint with no spinner.
  const [items, setItems] = useState<WatchlistItem[]>(
    () => cachedItems ?? [],
  );
  const [loading, setLoading] = useState<boolean>(() => !isCacheFresh());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    bustCache();
    setLoading(true);
    try {
      const next = await getItemsCached();
      setItems(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateLegacyToApi();
      if (cancelled) return;
      // Cache fresh? Local state is already correct from the lazy init.
      // Stale or empty? Trigger a fetch (deduped across instances).
      if (isCacheFresh()) return;
      try {
        const next = await getItemsCached();
        if (!cancelled) {
          setItems(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load watchlist",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isInWatchlist = useCallback(
    (symbol: string): boolean => {
      if (!symbol) return false;
      const t = symbol.toUpperCase();
      return items.some((i) => i.ticker === t);
    },
    [items],
  );

  // Optimistic add: insert a placeholder synchronously so the UI flips
  // instantly. On API failure we roll back by ticker (not by snapshot) so
  // concurrent mutations to other tickers are preserved.
  const addToWatchlist = useCallback(
    async (symbol: string): Promise<void> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return;

      let alreadyPresent = false;
      setItems((prev) => {
        if (prev.some((i) => i.ticker === t)) {
          alreadyPresent = true;
          return prev;
        }
        const optimistic: WatchlistItem = {
          ticker: t,
          addedAt: new Date().toISOString(),
        };
        const next = [optimistic, ...prev];
        // Mirror to module cache so the next mounted hook sees the change.
        setCache(next);
        return next;
      });

      try {
        const created = await addWatchlist(t);
        setItems((prev) => {
          const next = prev.map((i) => (i.ticker === t ? created : i));
          setCache(next);
          return next;
        });
        setError(null);
      } catch (e) {
        if (!alreadyPresent) {
          setItems((prev) => prev.filter((i) => i.ticker !== t));
        }
        // Cache is now ahead of server truth — bust it so the next hook
        // mount refetches authoritative data.
        bustCache();
        setError(e instanceof Error ? e.message : "Failed to add to watchlist");
      }
    },
    [],
  );

  // Optimistic remove: drop the row synchronously; on API failure restore it
  // (only if some later mutation hasn't already added it back).
  const removeFromWatchlist = useCallback(
    async (symbol: string): Promise<void> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return;

      let removedItem: WatchlistItem | null = null;
      setItems((prev) => {
        const found = prev.find((i) => i.ticker === t);
        if (!found) return prev;
        removedItem = found;
        const next = prev.filter((i) => i.ticker !== t);
        setCache(next);
        return next;
      });
      if (removedItem === null) return;
      const restored: WatchlistItem = removedItem;

      try {
        await removeWatchlist(t);
        setError(null);
      } catch (e) {
        setItems((prev) =>
          prev.some((i) => i.ticker === t) ? prev : [...prev, restored],
        );
        bustCache();
        setError(
          e instanceof Error ? e.message : "Failed to remove from watchlist",
        );
      }
    },
    [],
  );

  const toggle = useCallback(
    async (symbol: string): Promise<void> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return;
      if (items.some((i) => i.ticker === t)) {
        await removeFromWatchlist(t);
      } else {
        await addToWatchlist(t);
      }
    },
    [items, addToWatchlist, removeFromWatchlist],
  );

  return {
    items,
    loading,
    error,
    refresh,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    toggle,
    remove: removeFromWatchlist,
    isWatched: isInWatchlist,
    mounted: !loading,
  };
}
