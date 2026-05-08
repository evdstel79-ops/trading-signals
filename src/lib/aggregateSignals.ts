import { fetchInsiderTrades, type InsiderTrade } from "./insiderSignals";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "./politicalSignals";
import { scoreSwingSignal, type SwingSignalScore } from "./signalScoring";

export type RankedSignal = {
  ticker: string;
  score: SwingSignalScore;
  politicalCount: number;
  insiderCount: number;
};

type Bucket = {
  political: PoliticalTrade[];
  insider: InsiderTrade[];
};

function groupByTicker(
  political: PoliticalTrade[],
  insider: InsiderTrade[],
): Map<string, Bucket> {
  const byTicker = new Map<string, Bucket>();
  const get = (ticker: string): Bucket => {
    let b = byTicker.get(ticker);
    if (!b) {
      b = { political: [], insider: [] };
      byTicker.set(ticker, b);
    }
    return b;
  };

  for (const p of political) {
    if (!p.ticker) continue;
    get(p.ticker.toUpperCase()).political.push(p);
  }
  for (const i of insider) {
    if (!i.ticker) continue;
    get(i.ticker.toUpperCase()).insider.push(i);
  }
  return byTicker;
}

export async function aggregateAllSignals(
  now: number = Date.now(),
): Promise<RankedSignal[]> {
  const [politicalResult, insiderResult] = await Promise.allSettled([
    fetchPoliticalTrades(),
    fetchInsiderTrades(),
  ]);

  const political =
    politicalResult.status === "fulfilled" ? politicalResult.value : [];
  const insider =
    insiderResult.status === "fulfilled" ? insiderResult.value : [];

  const byTicker = groupByTicker(political, insider);

  const ranked: RankedSignal[] = [];
  for (const [ticker, { political: pol, insider: ins }] of byTicker) {
    const score = scoreSwingSignal(pol, ins, now);
    ranked.push({
      ticker,
      score,
      politicalCount: pol.length,
      insiderCount: ins.length,
    });
  }

  ranked.sort((a, b) => {
    if (b.score.score !== a.score.score) return b.score.score - a.score.score;
    return a.ticker.localeCompare(b.ticker);
  });
  return ranked;
}

export async function aggregateTopSignals(
  limit: number = 10,
  now: number = Date.now(),
): Promise<RankedSignal[]> {
  const all = await aggregateAllSignals(now);
  return all.slice(0, limit);
}
