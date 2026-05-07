export type Quote = {
  ticker: string;
  price: number;
  currency: string;
  symbol: string;
  previousClose: number | null;
  sector: string | null;
  industry: string | null;
};

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
} as const;

type YahooSearchHit = {
  symbol?: string;
  sector?: string;
  industry?: string;
};

type YahooSearchResponse = {
  quotes?: YahooSearchHit[];
};

async function fetchYahooProfile(
  ticker: string,
): Promise<{ sector: string | null; industry: string | null } | null> {
  // Yahoo's quoteSummary endpoint requires crumb auth; the search endpoint
  // exposes sector/industry without it.
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    ticker,
  )}&quotesCount=1&newsCount=0`;
  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooSearchResponse;
    const hit = data.quotes?.find((q) => q.symbol === ticker) ?? data.quotes?.[0];
    if (!hit) return null;
    return {
      sector: hit.sector ?? null,
      industry: hit.industry ?? null,
    };
  } catch {
    return null;
  }
}

type YahooMeta = {
  symbol?: string;
  currency?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
};

type YahooResponse = {
  chart?: {
    result?: { meta?: YahooMeta }[];
    error?: { description?: string } | null;
  };
};

async function fetchYahooQuote(ticker: string): Promise<Quote | null> {
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=1d`;
  try {
    const [chartRes, profile] = await Promise.all([
      fetch(chartUrl, {
        headers: YAHOO_HEADERS,
        next: { revalidate: 60 },
      }),
      fetchYahooProfile(ticker),
    ]);
    if (!chartRes.ok) return null;
    const data = (await chartRes.json()) as YahooResponse;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      ticker,
      price: meta.regularMarketPrice,
      currency: meta.currency ?? "USD",
      symbol: meta.symbol ?? ticker,
      previousClose:
        typeof meta.previousClose === "number"
          ? meta.previousClose
          : typeof meta.chartPreviousClose === "number"
            ? meta.chartPreviousClose
            : null,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchQuotes(
  tickers: string[],
): Promise<Record<string, Quote | null>> {
  const unique = Array.from(
    new Set(
      tickers.map((t) => t.trim().toUpperCase()).filter(Boolean),
    ),
  );
  if (unique.length === 0) return {};
  const results = await Promise.all(
    unique.map(async (t) => [t, await fetchYahooQuote(t)] as const),
  );
  const quotes: Record<string, Quote | null> = {};
  for (const [t, q] of results) quotes[t] = q;
  return quotes;
}
