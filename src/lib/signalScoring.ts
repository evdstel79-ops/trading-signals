export type ScorableTrade = {
  filedAt: string;
  amount: number;
  direction: "buy" | "sell" | "other";
  trader: string;
};

export type SignalScore = {
  /** Magnitude, capped at 100. */
  score: number;
  /** Raw signed value before capping (can exceed ±100). */
  signedScore: number;
  direction: "bullish" | "bearish" | "neutral";
  uniqueTraders: number;
  /** Multiplier applied from the consensus bonus (1.0, 1.5, or 2.0). */
  consensusMultiplier: number;
  /** Trades that actually contributed (had a direction, dollar amount, and parseable date). */
  tradesCounted: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function sizePoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount < 15_000) return 1;
  if (amount < 50_000) return 2;
  if (amount < 100_000) return 3;
  if (amount < 250_000) return 4;
  if (amount < 500_000) return 5;
  if (amount < 1_000_000) return 6;
  return 8;
}

function recencyWeight(daysOld: number): number {
  if (daysOld <= 7) return 1.0;
  if (daysOld <= 30) return 0.5;
  return 0.2;
}

function directionSign(d: ScorableTrade["direction"]): number {
  return d === "buy" ? 1 : d === "sell" ? -1 : 0;
}

export function calculateSignalScore(
  trades: ScorableTrade[],
  now: number = Date.now(),
): SignalScore {
  let signed = 0;
  let counted = 0;
  const traders = new Set<string>();

  for (const t of trades) {
    const sign = directionSign(t.direction);
    if (sign === 0) continue;
    const pts = sizePoints(t.amount);
    if (pts === 0) continue;
    const filedTs = Date.parse(t.filedAt);
    if (!Number.isFinite(filedTs)) continue;
    const daysOld = (now - filedTs) / DAY_MS;
    const recency = recencyWeight(daysOld);

    signed += sign * pts * recency;
    counted++;
    const traderKey = t.trader?.trim().toLowerCase() ?? "";
    if (traderKey) traders.add(traderKey);
  }

  const uniqueTraders = traders.size;
  let consensusMultiplier = 1.0;
  if (uniqueTraders >= 5) consensusMultiplier = 2.0;
  else if (uniqueTraders >= 3) consensusMultiplier = 1.5;

  const scaled = signed * consensusMultiplier;
  const magnitude = Math.min(100, Math.abs(scaled));

  let direction: SignalScore["direction"];
  if (Math.abs(scaled) < 0.5) direction = "neutral";
  else direction = scaled > 0 ? "bullish" : "bearish";

  return {
    score: Math.round(magnitude * 10) / 10,
    signedScore: scaled,
    direction,
    uniqueTraders,
    consensusMultiplier,
    tradesCounted: counted,
  };
}
