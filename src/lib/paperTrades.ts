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

export function computePnL(
  trade: Pick<PaperTrade, "direction" | "entryPrice" | "quantity">,
  currentPrice: number,
): number {
  const sign = trade.direction === "buy" ? 1 : -1;
  return sign * (currentPrice - trade.entryPrice) * trade.quantity;
}
