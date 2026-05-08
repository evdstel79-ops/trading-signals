import type { PoliticalTrade } from "@/lib/politicalSignals";
import {
  fetchTickerHistory,
  type HistoryPoint,
} from "@/lib/tickerHistory";

export type BacktestTrade = {
  ticker: string;
  politician: string;
  txDate: string;
  entryPrice: number;
  currentPrice: number;
  returnPct: number;
  side: "buy";
};

export type BacktestResult = {
  trades: BacktestTrade[];
  totalTrades: number;
  /** Fraction of trades with returnPct > 0, in 0..1. */
  winRate: number;
  /** Mean returnPct across all backtested trades, in %. */
  avgReturn: number;
  bestTrade: BacktestTrade | null;
  worstTrade: BacktestTrade | null;
  /**
   * Equal-weighted total return of the portfolio, in %. Equals avgReturn under
   * an equal-capital-per-trade assumption.
   */
  cumulativeReturn: number;
  /**
   * Cumulative equal-weighted index over time. Sorted ascending by trade date.
   * value[k] = 100 + sum(returnPct[0..k]) / totalTrades.
   * Final point sits at 100 + cumulativeReturn.
   */
  series: { date: string; value: number }[];
};

/**
 * Run an equal-weighted backtest over the supplied political trades.
 *
 * Eligible trades: side === 'buy', has txDate, has ticker, and txDate falls
 * within the 1y window covered by Yahoo's 1d/1y endpoint.
 *
 * Entry price = the daily close on txDate, or the close of the nearest
 * preceding trading day when txDate falls on a weekend/holiday. Current
 * price = the last close in the 1y history for that ticker.
 */
export async function runBacktest(
  trades: PoliticalTrade[],
): Promise<BacktestResult> {
  const buys = trades.filter(
    (t) => t.transactionType === "buy" && t.txDate && t.ticker,
  );

  const tickers = Array.from(
    new Set(buys.map((t) => t.ticker.toUpperCase())),
  );

  const histories = new Map<string, HistoryPoint[]>();
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const history = await fetchTickerHistory(ticker, "1y");
        histories.set(ticker, history);
      } catch {
        histories.set(ticker, []);
      }
    }),
  );

  const result: BacktestTrade[] = [];
  for (const trade of buys) {
    const ticker = trade.ticker.toUpperCase();
    const history = histories.get(ticker);
    if (!history || history.length === 0) continue;

    const targetTs = Date.parse(trade.txDate);
    if (!Number.isFinite(targetTs)) continue;

    const entry = findCloseOnOrBefore(history, targetTs);
    if (!entry) continue;
    if (entry.close <= 0) continue;

    const currentPrice = history[history.length - 1].close;
    const returnPct = ((currentPrice - entry.close) / entry.close) * 100;

    result.push({
      ticker,
      politician: trade.memberName,
      txDate: trade.txDate,
      entryPrice: entry.close,
      currentPrice,
      returnPct,
      side: "buy",
    });
  }

  result.sort((a, b) =>
    a.txDate < b.txDate ? -1 : a.txDate > b.txDate ? 1 : 0,
  );

  const totalTrades = result.length;
  const wins = result.filter((t) => t.returnPct > 0).length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;
  const avgReturn =
    totalTrades > 0
      ? result.reduce((sum, t) => sum + t.returnPct, 0) / totalTrades
      : 0;

  let bestTrade: BacktestTrade | null = null;
  let worstTrade: BacktestTrade | null = null;
  for (const t of result) {
    if (!bestTrade || t.returnPct > bestTrade.returnPct) bestTrade = t;
    if (!worstTrade || t.returnPct < worstTrade.returnPct) worstTrade = t;
  }

  const cumulativeReturn = avgReturn;

  const series: { date: string; value: number }[] = [];
  if (totalTrades > 0) {
    let runningSum = 0;
    for (const t of result) {
      runningSum += t.returnPct;
      series.push({
        date: t.txDate,
        value: 100 + runningSum / totalTrades,
      });
    }
  } else {
    series.push({ date: new Date().toISOString().slice(0, 10), value: 100 });
  }

  return {
    trades: result,
    totalTrades,
    winRate,
    avgReturn,
    bestTrade,
    worstTrade,
    cumulativeReturn,
    series,
  };
}

function findCloseOnOrBefore(
  history: HistoryPoint[],
  targetTs: number,
): HistoryPoint | null {
  let candidate: HistoryPoint | null = null;
  for (const point of history) {
    if (point.timestamp > targetTs) break;
    candidate = point;
  }
  return candidate;
}
