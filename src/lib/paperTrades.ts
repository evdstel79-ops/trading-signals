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
};

const STORAGE_KEY = "trading-signals.paper-trades.v1";

export function loadPaperTrades(): PaperTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PaperTrade[]) : [];
  } catch {
    return [];
  }
}

export function savePaperTrades(trades: PaperTrade[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export function addPaperTrade(
  input: Omit<PaperTrade, "id" | "addedAt">,
): PaperTrade {
  const trade: PaperTrade = {
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    addedAt: new Date().toISOString(),
  };
  const all = loadPaperTrades();
  all.push(trade);
  savePaperTrades(all);
  return trade;
}

export function deletePaperTrade(id: string): PaperTrade[] {
  const remaining = loadPaperTrades().filter((t) => t.id !== id);
  savePaperTrades(remaining);
  return remaining;
}

export function closePaperTrade(id: string, exitPrice: number): PaperTrade[] {
  const closedAt = new Date().toISOString();
  const updated = loadPaperTrades().map((t) =>
    t.id === id && !t.closedAt ? { ...t, closedAt, exitPrice } : t,
  );
  savePaperTrades(updated);
  return updated;
}

export function computePnL(
  trade: Pick<PaperTrade, "direction" | "entryPrice" | "quantity">,
  currentPrice: number,
): number {
  const sign = trade.direction === "buy" ? 1 : -1;
  return sign * (currentPrice - trade.entryPrice) * trade.quantity;
}

/**
 * Effective mark price for a trade: exit price if closed, otherwise the supplied
 * live price. Returns null when the trade is open and no live price is available.
 */
export function effectivePrice(
  trade: PaperTrade,
  currentPrice: number | null,
): number | null {
  if (typeof trade.exitPrice === "number") return trade.exitPrice;
  return currentPrice;
}

/**
 * Realized or unrealized P&L for a single trade. Returns null when the trade is
 * open and the live price isn't available yet.
 */
export function tradePnL(
  trade: PaperTrade,
  currentPrice: number | null,
): number | null {
  const price = effectivePrice(trade, currentPrice);
  return price === null ? null : computePnL(trade, price);
}
