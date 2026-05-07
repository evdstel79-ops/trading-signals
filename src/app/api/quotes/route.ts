import { NextResponse } from "next/server";

export const revalidate = 60;

export type Quote = {
  ticker: string;
  price: number;
  currency: string;
  symbol: string;
  previousClose: number | null;
};

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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com/",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooResponse;
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
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers") ?? "";
  const tickers = Array.from(
    new Set(
      tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: {} });
  }

  const results = await Promise.all(
    tickers.map(async (t) => [t, await fetchYahooQuote(t)] as const),
  );

  const quotes: Record<string, Quote | null> = {};
  for (const [ticker, quote] of results) {
    quotes[ticker] = quote;
  }

  return NextResponse.json({ quotes });
}
