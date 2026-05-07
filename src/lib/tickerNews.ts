export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
  thumbnail?: string;
};

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
} as const;

type YahooNewsThumbnailResolution = {
  url?: string;
  width?: number;
  height?: number;
  tag?: string;
};

type YahooNewsHit = {
  uuid?: string;
  title?: string;
  publisher?: string;
  providerPublishTime?: number;
  link?: string;
  type?: string;
  thumbnail?: { resolutions?: YahooNewsThumbnailResolution[] };
};

type YahooSearchResponse = {
  news?: YahooNewsHit[];
};

function pickThumbnail(
  thumb?: { resolutions?: YahooNewsThumbnailResolution[] },
): string | undefined {
  const resolutions = thumb?.resolutions ?? [];
  // Prefer the small square thumbnail; otherwise fall back to whatever's present.
  const small = resolutions.find((r) => r.tag === "140x140" && r.url);
  return small?.url ?? resolutions.find((r) => r.url)?.url;
}

export async function fetchTickerNews(ticker: string): Promise<NewsItem[]> {
  const trimmed = ticker.trim().toUpperCase();
  if (!trimmed) return [];
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    trimmed,
  )}&newsCount=10&quotesCount=0`;
  const res = await fetch(url, {
    headers: YAHOO_HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`yahoo news ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as YahooSearchResponse;
  const news = data.news ?? [];

  const items: NewsItem[] = [];
  for (const hit of news) {
    if (!hit.title || !hit.link) continue;
    const ts = hit.providerPublishTime;
    const publishedAt =
      typeof ts === "number" && Number.isFinite(ts)
        ? new Date(ts * 1000).toISOString()
        : "";
    items.push({
      id: hit.uuid ?? hit.link,
      title: hit.title,
      publisher: hit.publisher ?? "",
      publishedAt,
      url: hit.link,
      thumbnail: pickThumbnail(hit.thumbnail),
    });
  }
  return items;
}
