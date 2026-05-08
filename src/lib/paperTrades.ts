"use client";

import { useCallback, useEffect, useState } from "react";

export type PaperTradeDirection = "buy" | "sell";

export type PaperTrade = {
  id: string;
  ticker: string;
  direction: PaperTradeDirection;
  quantity: number;
  entryPrice: number;
  note: string;
  addedAt: string;
  source?: "political" | "insider" | "manual";
  /** ISO timestamp when the trade was closed. Absent on open positions. */
  closedAt?: string;
  /** Price at which the trade was closed. Absent on open positions. */
  exitPrice?: number;
  /** Auto-close if current price <= this level. */
  stopLoss?: number | null;
  /** Auto-close if current price >= this level. */
  takeProfit?: number | null;
  /** Free-form labels for journaling. Defaulted to [] when missing. */
  tags?: string[];
};

export type NewPaperTradeInput = {
  ticker: string;
  direction: PaperTradeDirection;
  quantity: number;
  entryPrice: number;
  note?: string;
  source?: PaperTrade["source"];
  stopLoss?: number | null;
  takeProfit?: number | null;
  tags?: string[];
};

const LEGACY_STORAGE_KEY = "trading-signals.paper-trades.v1";
const MIGRATION_FLAG = "trading-signals.paper-trades.migrated.v1";
const API_URL = "/api/paper-trades";

type ListResponse = { trades: PaperTrade[] } | { error: string };
type SingleResponse = { trade: PaperTrade } | { error: string };

async function expectTrades(res: Response): Promise<PaperTrade[]> {
  const data = (await res.json()) as ListResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.trades;
}

async function expectTrade(res: Response): Promise<PaperTrade> {
  const data = (await res.json()) as SingleResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.trade;
}

export async function loadPaperTrades(): Promise<PaperTrade[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  return expectTrades(res);
}

export async function addPaperTrade(
  input: NewPaperTradeInput,
): Promise<PaperTrade> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return expectTrade(res);
}

export async function closePaperTrade(
  id: string,
  exitPrice: number,
): Promise<PaperTrade> {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      closedAt: new Date().toISOString(),
      exitPrice,
    }),
  });
  return expectTrade(res);
}

export async function deletePaperTrade(id: string): Promise<PaperTrade> {
  const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return expectTrade(res);
}

export async function updateTradeNote(
  id: string,
  note: string,
): Promise<PaperTrade> {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, note }),
  });
  return expectTrade(res);
}

export async function updateTradeTags(
  id: string,
  tags: string[],
): Promise<PaperTrade> {
  const cleaned = Array.from(
    new Set(tags.map((t) => t.trim()).filter(Boolean)),
  );
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, tags: cleaned }),
  });
  return expectTrade(res);
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

  for (const t of parsed) {
    if (!t || typeof t !== "object") continue;
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
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

export type PaperTradesState = {
  trades: PaperTrade[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTrade: (input: NewPaperTradeInput) => Promise<PaperTrade>;
  closeTrade: (id: string, exitPrice: number) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  updateNote: (id: string, note: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => Promise<void>;
};

/**
 * React hook for the paper-trades collection. On mount it migrates any legacy
 * localStorage rows, then GETs the current list. Mutators call the API and
 * patch the local cache with the server response so the UI stays in sync
 * without a follow-up GET.
 */
export function usePaperTrades(): PaperTradesState {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadPaperTrades();
      setTrades(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load paper trades");
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

  const addTrade = useCallback(
    async (input: NewPaperTradeInput): Promise<PaperTrade> => {
      const created = await addPaperTrade(input);
      setTrades((prev) => (prev ? [created, ...prev] : [created]));
      return created;
    },
    [],
  );

  const replaceById = useCallback((updated: PaperTrade) => {
    setTrades((prev) =>
      prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev,
    );
  }, []);

  const closeTrade = useCallback(
    async (id: string, exitPrice: number): Promise<void> => {
      const updated = await closePaperTrade(id, exitPrice);
      replaceById(updated);
    },
    [replaceById],
  );

  const deleteTrade = useCallback(
    async (id: string): Promise<void> => {
      const updated = await deletePaperTrade(id);
      replaceById(updated);
    },
    [replaceById],
  );

  const updateNote = useCallback(
    async (id: string, note: string): Promise<void> => {
      const updated = await updateTradeNote(id, note);
      replaceById(updated);
    },
    [replaceById],
  );

  const updateTags = useCallback(
    async (id: string, tags: string[]): Promise<void> => {
      const updated = await updateTradeTags(id, tags);
      replaceById(updated);
    },
    [replaceById],
  );

  return {
    trades,
    loading,
    error,
    refresh,
    addTrade,
    closeTrade,
    deleteTrade,
    updateNote,
    updateTags,
  };
}

export function computePnL(
  trade: Pick<PaperTrade, "direction" | "entryPrice" | "quantity">,
  currentPrice: number,
): number {
  const sign = trade.direction === "buy" ? 1 : -1;
  return sign * (currentPrice - trade.entryPrice) * trade.quantity;
}

/**
 * Effective mark price for a trade: exit price if closed, otherwise the
 * supplied live price. Returns null when the trade is open and no live
 * price is available.
 */
export function effectivePrice(
  trade: PaperTrade,
  currentPrice: number | null,
): number | null {
  if (typeof trade.exitPrice === "number") return trade.exitPrice;
  return currentPrice;
}

/**
 * Realized or unrealized P&L for a single trade. Returns null when the
 * trade is open and the live price isn't available yet.
 */
export function tradePnL(
  trade: PaperTrade,
  currentPrice: number | null,
): number | null {
  const price = effectivePrice(trade, currentPrice);
  return price === null ? null : computePnL(trade, price);
}
