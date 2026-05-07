"use client";

import { useEffect, useState } from "react";

export type WatchlistItem = {
  ticker: string;
  addedAt: string;
};

const STORAGE_KEY = "trading-signals.watchlist.v1";

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadWatchlist());
    setMounted(true);
  }, []);

  function isWatched(ticker: string): boolean {
    if (!ticker) return false;
    const t = ticker.toUpperCase();
    return items.some((i) => i.ticker === t);
  }

  function toggle(ticker: string): void {
    if (!ticker) return;
    const t = ticker.toUpperCase();
    setItems((prev) => {
      const next = prev.some((i) => i.ticker === t)
        ? prev.filter((i) => i.ticker !== t)
        : [...prev, { ticker: t, addedAt: new Date().toISOString() }];
      saveWatchlist(next);
      return next;
    });
  }

  function remove(ticker: string): void {
    const t = ticker.toUpperCase();
    setItems((prev) => {
      const next = prev.filter((i) => i.ticker !== t);
      saveWatchlist(next);
      return next;
    });
  }

  return { items, isWatched, toggle, remove, mounted };
}
