import type { InsiderTrade } from "./insiderSignals";
import type { PoliticalTrade } from "./politicalSignals";

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

/**
 * Swing-trade signal score for a single ticker on a 1–10 scale.
 *
 * Combines political and insider buys (sells are ignored — this is a long-bias
 * scoring system). Returns a `reasons` array suitable for showing the user
 * why the ticker scored where it did.
 */
export type SwingSignalScore = {
  score: number;
  reasons: string[];
};

const swingDollarFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function scoreSwingSignal(
  political: PoliticalTrade[],
  insider: InsiderTrade[],
  now: number = Date.now(),
): SwingSignalScore {
  const buyers = new Set<string>();
  let totalDollars = 0;
  let mostRecentBuyMs: number | null = null;
  let hasPoliticalBuy = false;
  let hasInsiderBuy = false;

  for (const p of political) {
    if (p.transactionType !== "buy") continue;
    hasPoliticalBuy = true;
    const trader = p.memberName.trim().toLowerCase();
    if (trader) buyers.add(`pol:${trader}`);
    if (Number.isFinite(p.value) && p.value > 0) totalDollars += p.value;
    const ts = Date.parse(p.filedAt);
    if (Number.isFinite(ts) && (mostRecentBuyMs === null || ts > mostRecentBuyMs)) {
      mostRecentBuyMs = ts;
    }
  }

  for (const i of insider) {
    if (i.transactionType !== "buy") continue;
    hasInsiderBuy = true;
    const trader = i.insiderName.trim().toLowerCase();
    if (trader) buyers.add(`ins:${trader}`);
    if (Number.isFinite(i.value) && i.value > 0) totalDollars += i.value;
    const ts = Date.parse(i.filedAt);
    if (Number.isFinite(ts) && (mostRecentBuyMs === null || ts > mostRecentBuyMs)) {
      mostRecentBuyMs = ts;
    }
  }

  const reasons: string[] = [];
  let raw = 1;

  const buyerCount = buyers.size;
  if (buyerCount > 0) {
    raw += Math.min(buyerCount, 4);
    reasons.push(`${buyerCount} unique buyer${buyerCount === 1 ? "" : "s"}`);
  }

  if (totalDollars > 0) {
    let dollarPts: number;
    if (totalDollars >= 1_000_000) dollarPts = 3;
    else if (totalDollars >= 250_000) dollarPts = 2;
    else if (totalDollars >= 50_000) dollarPts = 1;
    else dollarPts = 0.5;
    raw += dollarPts;
    reasons.push(`${swingDollarFmt.format(totalDollars)} bought`);
  }

  if (mostRecentBuyMs !== null) {
    const daysOld = (now - mostRecentBuyMs) / DAY_MS;
    if (daysOld <= 7) {
      raw += 2;
      reasons.push(
        daysOld < 1 ? "Bought today" : `Bought ${Math.max(1, Math.round(daysOld))}d ago`,
      );
    } else if (daysOld <= 30) {
      raw += 1;
      reasons.push(`Bought ${Math.round(daysOld)}d ago`);
    } else {
      reasons.push(`Last buy ${Math.round(daysOld)}d ago`);
    }
  }

  if (hasPoliticalBuy && hasInsiderBuy) {
    raw += 2;
    reasons.push("Political + insider buys");
  }

  const score = Math.max(1, Math.min(10, Math.round(raw)));
  if (reasons.length === 0) reasons.push("No recent buys");

  return { score, reasons };
}
