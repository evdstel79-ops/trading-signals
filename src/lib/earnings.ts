export type EarningsTiming = "BMO" | "AMC" | "unknown";

export type TickerEarnings = {
  ticker: string;
  /** ISO date of the next scheduled earnings call, or null if unknown. */
  earningsDate: string | null;
  /** Analyst-consensus EPS estimate, or null if unavailable. */
  epsEstimate: number | null;
  /** Analyst-consensus revenue estimate (USD), or null if unavailable. */
  revenueEstimate: number | null;
  timing: EarningsTiming;
  companyName: string | null;
};

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
} as const;

// Yahoo's quoteSummary endpoint is gated by a session cookie + a "crumb"
// token. The handshake is:
//   1. GET fc.yahoo.com to receive Set-Cookie headers (A1, A3, GUC, …).
//   2. GET query1/v1/test/getcrumb with those cookies; the response body is
//      the crumb string, which must be appended as &crumb=… on subsequent
//      quoteSummary requests, with the same cookies attached.
// We cache the pair at module scope and refresh on 401/403 or after 30 min.
type YahooAuth = { crumb: string; cookie: string };
let cachedAuth: (YahooAuth & { expiresAt: number }) | null = null;
let inFlightAuth: Promise<YahooAuth | null> | null = null;
const AUTH_TTL_MS = 30 * 60 * 1000;

async function refreshYahooAuth(): Promise<YahooAuth | null> {
  try {
    // fc.yahoo.com/error returns 404 but sets the A3 session cookie that the
    // crumb endpoint requires. fc.yahoo.com/ alone only sets a B cookie which
    // is rejected by /v1/test/getcrumb (returns 406).
    const consentRes = await fetch("https://fc.yahoo.com/error", {
      headers: YAHOO_HEADERS,
      redirect: "manual",
      cache: "no-store",
    });
    const setCookies = consentRes.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) return null;
    const cookieHeader = setCookies
      .map((entry) => entry.split(";", 1)[0])
      .filter(Boolean)
      .join("; ");
    if (!cookieHeader) return null;

    const crumbRes = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: { ...YAHOO_HEADERS, Cookie: cookieHeader },
        cache: "no-store",
      },
    );
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;
    return { crumb, cookie: cookieHeader };
  } catch {
    return null;
  }
}

async function getYahooAuth(forceRefresh = false): Promise<YahooAuth | null> {
  if (
    !forceRefresh &&
    cachedAuth &&
    cachedAuth.expiresAt > Date.now()
  ) {
    return { crumb: cachedAuth.crumb, cookie: cachedAuth.cookie };
  }
  if (inFlightAuth && !forceRefresh) return inFlightAuth;
  inFlightAuth = (async () => {
    const fresh = await refreshYahooAuth();
    if (fresh) {
      cachedAuth = { ...fresh, expiresAt: Date.now() + AUTH_TTL_MS };
    } else if (forceRefresh) {
      cachedAuth = null;
    }
    return fresh;
  })();
  try {
    return await inFlightAuth;
  } finally {
    inFlightAuth = null;
  }
}

type YahooNumeric = { raw?: number; fmt?: string };

type YahooEarningsCalendarEvent = {
  earningsDate?: YahooNumeric[];
  earningsAverage?: YahooNumeric;
  revenueAverage?: YahooNumeric;
};

type YahooQuoteSummaryResult = {
  calendarEvents?: { earnings?: YahooEarningsCalendarEvent };
  price?: { longName?: string; shortName?: string };
};

type YahooQuoteSummaryResponse = {
  quoteSummary?: {
    result?: YahooQuoteSummaryResult[];
    error?: { description?: string } | null;
  };
};

function classifyTiming(epochSec: number): EarningsTiming {
  // Yahoo reports earnings dates as a single epoch with the time-of-day hinting
  // at session: BMO calls land before market open, AMC after close. UTC hour
  // boundaries account for both DST and standard time on the US East coast:
  //   Before 13:00 UTC ≈ before 8 AM ET → BMO
  //   After 21:00 UTC ≈ after 4 PM ET → AMC
  const date = new Date(epochSec * 1000);
  const hour = date.getUTCHours();
  if (hour < 13) return "BMO";
  if (hour >= 21) return "AMC";
  return "unknown";
}

async function fetchQuoteSummary(
  ticker: string,
  auth: YahooAuth,
): Promise<Response> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}?modules=calendarEvents,price&crumb=${encodeURIComponent(auth.crumb)}`;
  return fetch(url, {
    headers: { ...YAHOO_HEADERS, Cookie: auth.cookie },
    next: { revalidate: 3600 },
  });
}

export async function fetchTickerEarnings(
  ticker: string,
): Promise<TickerEarnings | null> {
  const trimmed = ticker.trim().toUpperCase();
  if (!trimmed) return null;

  try {
    let auth = await getYahooAuth();
    if (!auth) return emptyEarnings(trimmed);
    let res = await fetchQuoteSummary(trimmed, auth);
    // 401/403 means the cached crumb has aged out or the cookie was rotated;
    // grab a fresh pair and try once more.
    if (res.status === 401 || res.status === 403) {
      auth = await getYahooAuth(true);
      if (!auth) return emptyEarnings(trimmed);
      res = await fetchQuoteSummary(trimmed, auth);
    }
    if (!res.ok) return emptyEarnings(trimmed);
    const data = (await res.json()) as YahooQuoteSummaryResponse;
    const result = data.quoteSummary?.result?.[0];
    if (!result) return emptyEarnings(trimmed);

    const earnings = result.calendarEvents?.earnings;
    const dates = earnings?.earningsDate ?? [];
    // Yahoo can return [start, end] for an estimated window, or a single
    // confirmed date. Take the earliest entry as the "next" date.
    const firstDate = dates.find(
      (d) => typeof d.raw === "number" && Number.isFinite(d.raw),
    );

    const earningsDate =
      firstDate?.raw !== undefined
        ? new Date(firstDate.raw * 1000).toISOString()
        : null;
    const timing =
      firstDate?.raw !== undefined ? classifyTiming(firstDate.raw) : "unknown";

    const epsEstimate =
      typeof earnings?.earningsAverage?.raw === "number"
        ? earnings.earningsAverage.raw
        : null;
    const revenueEstimate =
      typeof earnings?.revenueAverage?.raw === "number"
        ? earnings.revenueAverage.raw
        : null;

    const companyName =
      result.price?.longName ?? result.price?.shortName ?? null;

    return {
      ticker: trimmed,
      earningsDate,
      epsEstimate,
      revenueEstimate,
      timing,
      companyName,
    };
  } catch {
    return emptyEarnings(trimmed);
  }
}

function emptyEarnings(ticker: string): TickerEarnings {
  return {
    ticker,
    earningsDate: null,
    epsEstimate: null,
    revenueEstimate: null,
    timing: "unknown",
    companyName: null,
  };
}

export async function fetchEarningsForTickers(
  tickers: string[],
): Promise<TickerEarnings[]> {
  const unique = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );
  if (unique.length === 0) return [];
  const results = await Promise.all(unique.map(fetchTickerEarnings));
  return results.filter((r): r is TickerEarnings => r !== null);
}
