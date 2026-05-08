"use client";

import { useCallback, useEffect, useState } from "react";

export type WatchlistItem = {
  ticker: string;
  addedAt: string;
};

const LEGACY_STORAGE_KEY = "trading-signals.watchlist.v1";
const MIGRATION_FLAG = "trading-signals.watchlist.migrated.v1";
const API_URL = "/api/watchlist";

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
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listWatchlist();
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
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const isInWatchlist = useCallback(
    (symbol: string): boolean => {
      if (!symbol) return false;
      const t = symbol.toUpperCase();
      return items.some((i) => i.ticker === t);
    },
    [items],
  );

  const addToWatchlist = useCallback(
    async (symbol: string): Promise<void> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return;
      try {
        const created = await addWatchlist(t);
        setItems((prev) => {
          const without = prev.filter((i) => i.ticker !== t);
          return [created, ...without];
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add to watchlist");
      }
    },
    [],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string): Promise<void> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return;
      try {
        await removeWatchlist(t);
        setItems((prev) => prev.filter((i) => i.ticker !== t));
        setError(null);
      } catch (e) {
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
