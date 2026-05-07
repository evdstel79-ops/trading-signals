export type HistoryRange = "1mo" | "3mo" | "1y";

export type HistoryPoint = {
  /** YYYY-MM-DD */
  date: string;
  /** Unix ms timestamp at market open of the bar. */
  timestamp: number;
  close: number;
  volume: number | null;
};

const VALID_RANGES: ReadonlySet<HistoryRange> = new Set(["1mo", "3mo", "1y"]);

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
} as const;

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
};

export function isValidRange(r: string): r is HistoryRange {
  return VALID_RANGES.has(r as HistoryRange);
}

export async function fetchTickerHistory(
  ticker: string,
  range: HistoryRange,
): Promise<HistoryPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: YAHOO_HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`yahoo history ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as YahooChart;
  const result = data.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const volumes = result.indicators?.quote?.[0]?.volume ?? [];

  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    const tsMs = timestamps[i] * 1000;
    points.push({
      date: new Date(tsMs).toISOString().slice(0, 10),
      timestamp: tsMs,
      close,
      volume:
        typeof volumes[i] === "number" && Number.isFinite(volumes[i])
          ? (volumes[i] as number)
          : null,
    });
  }
  return points;
}
