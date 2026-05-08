import {
  getYahooAuth,
  YAHOO_HEADERS,
  type YahooAuth,
} from "@/lib/yahooAuth";

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
