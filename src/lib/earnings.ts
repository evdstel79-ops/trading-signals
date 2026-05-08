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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SEC_CH_UA = {
  "sec-ch-ua":
    '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
} as const;

// Headers a real browser sends when *navigating* to a URL. Yahoo issues a
// richer A3 session cookie under these — sending XHR-style headers instead
// gets a 1-cookie response that /v1/test/getcrumb later 406s.
const NAV_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  ...SEC_CH_UA,
} as const;

// XHR-style headers for API calls. Used with the cookies obtained via
// NAV_HEADERS plus the crumb token.
const YAHOO_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  Referer: "https://finance.yahoo.com/",
  ...SEC_CH_UA,
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
    // login.yahoo.com is hit with navigation-style headers so Yahoo issues
    // a fully-signed multi-cookie session (A1, A1S, A3, GUC). fc.yahoo.com
    // works as a fallback but gives a smaller cookie that's been observed
    // to fail intermittently after the IP has been seen too many times.
    const consentRes = await fetch(
      "https://login.yahoo.com/?.intl=us&.lang=en-US&.done=https%3A%2F%2Ffinance.yahoo.com",
      {
        headers: NAV_HEADERS,
        redirect: "manual",
        cache: "no-store",
      },
    );
    const setCookies = consentRes.headers.getSetCookie?.() ?? [];
    console.log(
      "[earnings] consent status:",
      consentRes.status,
      "cookies:",
      setCookies.length,
    );
    if (setCookies.length === 0) return null;
    const cookieHeader = setCookies
      .map((entry) => entry.split(";", 1)[0])
      .filter(Boolean)
      .join("; ");
    if (!cookieHeader) return null;

    const crumbRes = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        // The crumb endpoint returns plain text, not JSON. Sending
        // Accept: application/json triggers a 406 "Not Acceptable" — */*
        // is required.
        headers: { ...YAHOO_HEADERS, Accept: "*/*", Cookie: cookieHeader },
        cache: "no-store",
      },
    );
    console.log("[earnings] crumb status:", crumbRes.status);
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;
    console.log(
      "[earnings] auth ready · crumb:",
      JSON.stringify(crumb),
      "cookie:",
      cookieHeader.slice(0, 80) + (cookieHeader.length > 80 ? "…" : ""),
    );
    return { crumb, cookie: cookieHeader };
  } catch (err) {
    console.log("[earnings] auth refresh threw:", err);
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
  console.log("[earnings] GET", url);
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
    if (!auth) {
      console.log("[earnings]", trimmed, "no auth");
      return emptyEarnings(trimmed);
    }
    let res = await fetchQuoteSummary(trimmed, auth);
    // 401/403 means the cached crumb has aged out or the cookie was rotated;
    // grab a fresh pair and try once more.
    if (res.status === 401 || res.status === 403) {
      console.log(
        "[earnings]",
        trimmed,
        "auth rejected, refreshing crumb",
      );
      auth = await getYahooAuth(true);
      if (!auth) return emptyEarnings(trimmed);
      res = await fetchQuoteSummary(trimmed, auth);
    }
    console.log("[earnings]", trimmed, "summary status:", res.status);
    if (trimmed === "KO") {
      const cloned = res.clone();
      const body = await cloned.text();
      console.log(
        "[earnings] KO body (first 500):",
        body.slice(0, 500),
      );
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
  } catch (err) {
    console.log("[earnings]", trimmed, "threw:", err);
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
