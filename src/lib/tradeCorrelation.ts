import type { Party, PoliticalTrade } from "@/lib/politicalSignals";

export type Correlation = {
  ticker: string;
  politicians: string[];
  parties: Party[];
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  firstTrade: string;
  lastTrade: string;
  windowDays: number;
  bipartisan: boolean;
  correlationScore: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 90;
const WINDOW_MS = WINDOW_DAYS * DAY_MS;

export function detectCorrelations(trades: PoliticalTrade[]): Correlation[] {
  const byTicker = new Map<string, PoliticalTrade[]>();
  for (const t of trades) {
    if (!t.ticker) continue;
    const ticker = t.ticker.toUpperCase();
    let arr = byTicker.get(ticker);
    if (!arr) {
      arr = [];
      byTicker.set(ticker, arr);
    }
    arr.push(t);
  }

  const correlations: Correlation[] = [];
  for (const [ticker, group] of byTicker) {
    const cluster = findBestCluster(group);
    if (!cluster) continue;
    correlations.push(buildCorrelation(ticker, cluster.trades, cluster.windowDays));
  }

  correlations.sort((a, b) => {
    if (b.correlationScore !== a.correlationScore) {
      return b.correlationScore - a.correlationScore;
    }
    return b.tradeCount - a.tradeCount;
  });
  return correlations;
}

/**
 * Slide a 90-day window over chronologically sorted trades and return the
 * window with the most trades that contains 2+ unique politicians. Returns
 * null if no such window exists.
 */
function findBestCluster(
  group: PoliticalTrade[],
): { trades: PoliticalTrade[]; windowDays: number } | null {
  const sorted = [...group]
    .map((t) => ({ trade: t, ts: Date.parse(t.filedAt) }))
    .filter((x) => Number.isFinite(x.ts))
    .sort((a, b) => a.ts - b.ts);

  let best: { trades: PoliticalTrade[]; windowDays: number } | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const cluster: typeof sorted = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].ts - sorted[i].ts > WINDOW_MS) break;
      cluster.push(sorted[j]);
    }
    const uniquePoliticians = new Set(
      cluster.map((c) => c.trade.memberName),
    ).size;
    if (uniquePoliticians < 2) continue;
    if (!best || cluster.length > best.trades.length) {
      const span = cluster[cluster.length - 1].ts - cluster[0].ts;
      best = {
        trades: cluster.map((c) => c.trade),
        windowDays: Math.round(span / DAY_MS),
      };
    }
  }
  return best;
}

function buildCorrelation(
  ticker: string,
  trades: PoliticalTrade[],
  windowDays: number,
): Correlation {
  const politicians = Array.from(
    new Set(trades.map((t) => t.memberName)),
  ).sort();

  const partyByPolitician = new Map<string, Party>();
  for (const t of trades) {
    if (!partyByPolitician.has(t.memberName)) {
      partyByPolitician.set(t.memberName, t.party);
    }
  }
  const parties = Array.from(new Set(partyByPolitician.values()));

  let buyCount = 0;
  let sellCount = 0;
  for (const t of trades) {
    if (t.transactionType === "buy") buyCount++;
    else if (t.transactionType === "sell") sellCount++;
  }

  const dates = trades.map((t) => t.filedAt).sort();
  const firstTrade = dates[0];
  const lastTrade = dates[dates.length - 1];

  const partySet = new Set(parties);
  const bipartisan = partySet.has("R") && partySet.has("D");

  const correlationScore =
    politicians.length * 2 +
    (bipartisan ? 5 : 0) +
    (buyCount > sellCount ? 2 : 0);

  return {
    ticker,
    politicians,
    parties,
    tradeCount: trades.length,
    buyCount,
    sellCount,
    firstTrade,
    lastTrade,
    windowDays,
    bipartisan,
    correlationScore,
  };
}

/**
 * Convenience map of ticker → cluster size for fast lookups in row renders.
 */
export function correlationCountByTicker(
  trades: PoliticalTrade[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const c of detectCorrelations(trades)) {
    result.set(c.ticker, c.politicians.length);
  }
  return result;
}

/**
 * Look up which party a politician trades under, given a list of trades.
 * Same-name politicians always have the same party in the upstream data.
 */
export function partyOf(
  trades: PoliticalTrade[],
  politicianName: string,
): Party {
  for (const t of trades) {
    if (t.memberName === politicianName) return t.party;
  }
  return "Unknown";
}
