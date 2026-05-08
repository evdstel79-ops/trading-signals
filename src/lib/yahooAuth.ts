// Shared Yahoo Finance auth helper.
//
// Yahoo's quoteSummary (and several other gated APIs) require a session
// cookie + crumb pair. The handshake:
//   1. GET https://login.yahoo.com/?.intl=us&.lang=en-US&.done=…
//      with browser-style "navigation" headers — this issues a fully signed
//      multi-cookie session (AS, A1, A1S, A3) that's authoritative enough
//      for the crumb endpoint.
//   2. GET /v1/test/getcrumb with those cookies. The endpoint returns plain
//      text and 406s if you ask for application/json — Accept: */* is
//      mandatory.
//   3. Append &crumb={crumb} to the gated request URL and send the cookies
//      via the Cookie header.
//
// We cache the pair at module scope (30 min) and refresh on 401/403.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SEC_CH_UA = {
  "sec-ch-ua":
    '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
} as const;

/** Headers a real browser sends when navigating to a URL (gets richer cookies). */
export const NAV_HEADERS = {
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

/** XHR-style headers for API calls; used with the cookies + crumb. */
export const YAHOO_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  Referer: "https://finance.yahoo.com/",
  ...SEC_CH_UA,
} as const;

export type YahooAuth = { crumb: string; cookie: string };

let cachedAuth: (YahooAuth & { expiresAt: number }) | null = null;
let inFlightAuth: Promise<YahooAuth | null> | null = null;
const AUTH_TTL_MS = 30 * 60 * 1000;

async function refreshYahooAuth(): Promise<YahooAuth | null> {
  try {
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
      "[yahoo-auth] consent status:",
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
        // Accept: application/json triggers a 406 — */* is required.
        headers: { ...YAHOO_HEADERS, Accept: "*/*", Cookie: cookieHeader },
        cache: "no-store",
      },
    );
    console.log("[yahoo-auth] crumb status:", crumbRes.status);
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;
    console.log(
      "[yahoo-auth] auth ready · crumb:",
      JSON.stringify(crumb),
      "cookie:",
      cookieHeader.slice(0, 80) + (cookieHeader.length > 80 ? "…" : ""),
    );
    return { crumb, cookie: cookieHeader };
  } catch (err) {
    console.log("[yahoo-auth] refresh threw:", err);
    return null;
  }
}

export async function getYahooAuth(
  forceRefresh = false,
): Promise<YahooAuth | null> {
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
