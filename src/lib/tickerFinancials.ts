import {
  getYahooAuth,
  YAHOO_HEADERS,
  type YahooAuth,
} from "@/lib/yahooAuth";

export type RecommendationKey =
  | "strong_buy"
  | "buy"
  | "hold"
  | "underperform"
  | "sell"
  | "none";

export type EarningsHistoryEntry = {
  /** Quarter end date, e.g. "2026-03-31". */
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
};

export type TickerFinancials = {
  ticker: string;
  companyName: string | null;

  // Key statistics
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  eps: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  avgVolume: number | null;
  beta: number | null;

  // Analyst ratings
  recommendationMean: number | null;
  recommendationKey: RecommendationKey;
  numberOfAnalystOpinions: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;

  // Earnings history (last 4 quarters, oldest → newest)
  earningsHistory: EarningsHistoryEntry[];
};

type YahooNumeric = { raw?: number; fmt?: string };

type YahooPrice = {
  longName?: string;
  shortName?: string;
};

type YahooSummaryDetail = {
  marketCap?: YahooNumeric;
  trailingPE?: YahooNumeric;
  dividendYield?: YahooNumeric;
  fiftyTwoWeekHigh?: YahooNumeric;
  fiftyTwoWeekLow?: YahooNumeric;
  averageVolume?: YahooNumeric;
  averageDailyVolume10Day?: YahooNumeric;
  beta?: YahooNumeric;
};

type YahooDefaultKeyStatistics = {
  forwardPE?: YahooNumeric;
  priceToBook?: YahooNumeric;
  trailingEps?: YahooNumeric;
  forwardEps?: YahooNumeric;
  beta?: YahooNumeric;
};

type YahooFinancialData = {
  recommendationMean?: YahooNumeric;
  recommendationKey?: string;
  numberOfAnalystOpinions?: YahooNumeric;
  targetMeanPrice?: YahooNumeric;
  targetHighPrice?: YahooNumeric;
  targetLowPrice?: YahooNumeric;
};

type YahooEarningsHistoryEntry = {
  quarter?: YahooNumeric;
  epsActual?: YahooNumeric;
  epsEstimate?: YahooNumeric;
  epsDifference?: YahooNumeric;
  surprisePercent?: YahooNumeric;
};

type YahooEarningsHistory = {
  history?: YahooEarningsHistoryEntry[];
};

type YahooQuoteSummaryResult = {
  price?: YahooPrice;
  summaryDetail?: YahooSummaryDetail;
  defaultKeyStatistics?: YahooDefaultKeyStatistics;
  financialData?: YahooFinancialData;
  earningsHistory?: YahooEarningsHistory;
};

type YahooQuoteSummaryResponse = {
  quoteSummary?: {
    result?: YahooQuoteSummaryResult[];
    error?: { description?: string } | null;
  };
};

const MODULES = [
  "financialData",
  "defaultKeyStatistics",
  "summaryDetail",
  "price",
  "earningsHistory",
].join(",");

async function fetchSummary(
  ticker: string,
  auth: YahooAuth,
): Promise<Response> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}?modules=${MODULES}&crumb=${encodeURIComponent(auth.crumb)}`;
  return fetch(url, {
    headers: { ...YAHOO_HEADERS, Cookie: auth.cookie },
    next: { revalidate: 3600 },
  });
}

function num(value?: YahooNumeric): number | null {
  return typeof value?.raw === "number" && Number.isFinite(value.raw)
    ? value.raw
    : null;
}

function recommendationKey(value?: string): RecommendationKey {
  switch ((value ?? "").toLowerCase()) {
    case "strong_buy":
      return "strong_buy";
    case "buy":
      return "buy";
    case "hold":
      return "hold";
    case "underperform":
      return "underperform";
    case "sell":
      return "sell";
    default:
      return "none";
  }
}

export async function fetchTickerFinancials(
  ticker: string,
): Promise<TickerFinancials | null> {
  const trimmed = ticker.trim().toUpperCase();
  if (!trimmed) return null;

  let auth = await getYahooAuth();
  if (!auth) return null;
  let res = await fetchSummary(trimmed, auth);
  if (res.status === 401 || res.status === 403) {
    auth = await getYahooAuth(true);
    if (!auth) return null;
    res = await fetchSummary(trimmed, auth);
  }
  if (!res.ok) return null;

  const data = (await res.json()) as YahooQuoteSummaryResponse;
  const result = data.quoteSummary?.result?.[0];
  if (!result) return null;

  const summary = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const financial = result.financialData ?? {};
  const history = result.earningsHistory?.history ?? [];

  const earningsHistory: EarningsHistoryEntry[] = history
    .map((h): EarningsHistoryEntry | null => {
      const ts = h.quarter?.raw;
      if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      const epsActual = num(h.epsActual);
      const epsEstimate = num(h.epsEstimate);
      const surprisePctRaw = num(h.surprisePercent);
      const surprisePct =
        surprisePctRaw !== null
          ? Math.abs(surprisePctRaw) <= 1
            ? surprisePctRaw * 100 // some tickers report fractional surprise
            : surprisePctRaw
          : null;
      return { date, epsActual, epsEstimate, surprisePct };
    })
    .filter((e): e is EarningsHistoryEntry => e !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-4);

  return {
    ticker: trimmed,
    companyName: result.price?.longName ?? result.price?.shortName ?? null,

    marketCap: num(summary.marketCap),
    peRatio: num(summary.trailingPE),
    forwardPE: num(stats.forwardPE),
    priceToBook: num(stats.priceToBook),
    eps: num(stats.trailingEps),
    dividendYield: num(summary.dividendYield),
    fiftyTwoWeekHigh: num(summary.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(summary.fiftyTwoWeekLow),
    avgVolume: num(summary.averageVolume) ?? num(summary.averageDailyVolume10Day),
    beta: num(stats.beta) ?? num(summary.beta),

    recommendationMean: num(financial.recommendationMean),
    recommendationKey: recommendationKey(financial.recommendationKey),
    numberOfAnalystOpinions: num(financial.numberOfAnalystOpinions),
    targetMeanPrice: num(financial.targetMeanPrice),
    targetHighPrice: num(financial.targetHighPrice),
    targetLowPrice: num(financial.targetLowPrice),

    earningsHistory,
  };
}
