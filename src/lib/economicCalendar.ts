export type EventImpact = "high" | "medium" | "low";

export type EconomicEvent = {
  /** ISO date (YYYY-MM-DD). Pure dates, no time-of-day. */
  date: string;
  event: string;
  country: string;
  currency: string;
  impact: EventImpact;
  isFomc: boolean;
  forecast?: string;
  previous?: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  GB: "🇬🇧",
  JP: "🇯🇵",
  CN: "🇨🇳",
  CA: "🇨🇦",
  AU: "🇦🇺",
  CH: "🇨🇭",
};

export function flagFor(country: string): string {
  return COUNTRY_FLAGS[country] ?? "";
}

// Hardcoded calendar of major macro events for 2026. Sources of dates:
//   FOMC: federalreserve.gov/monetarypolicy/fomccalendars.htm
//   NFP / Employment Situation: BLS release schedule (first Fri of month,
//     bumped to Thu when the 1st falls on a holiday week).
//   CPI: BLS schedule (~10–14 of each month).
//   ECB: ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
//   GDP advance: BEA release schedule (~end of month following the quarter).
const EVENTS: EconomicEvent[] = [
  // April 2026 (recent past — useful for "this week" lookbacks).
  fomc("2026-04-29", "FOMC Rate Decision", { forecast: "5.25%", previous: "5.50%" }),
  nfp("2026-05-01", { forecast: "180K", previous: "303K" }),

  // May 2026
  cpi("2026-05-13", { forecast: "0.3%", previous: "0.4%" }),

  // June 2026
  ecb("2026-06-04", "ECB Rate Decision", { forecast: "3.25%", previous: "3.25%" }),
  nfp("2026-06-05", { forecast: "175K", previous: "180K" }),
  cpi("2026-06-11", { forecast: "0.2%", previous: "0.3%" }),
  fomc("2026-06-17", "FOMC Rate Decision", { forecast: "5.25%", previous: "5.25%" }),
  fomc("2026-06-17", "Fed Chair Press Conference", {
    impact: "high",
    forecast: "—",
    previous: "—",
  }),

  // July 2026
  nfp("2026-07-02", { forecast: "170K", previous: "175K" }),
  cpi("2026-07-15", { forecast: "0.2%", previous: "0.2%" }),
  ecb("2026-07-23", "ECB Rate Decision", { forecast: "3.25%", previous: "3.25%" }),
  fomc("2026-07-29", "FOMC Rate Decision", { forecast: "5.00%", previous: "5.25%" }),
  fomc("2026-07-29", "Fed Chair Press Conference", { impact: "high" }),
  gdp("2026-07-30", "GDP Q2 Advance", { forecast: "2.0%", previous: "2.4%" }),

  // August 2026
  nfp("2026-08-07", { forecast: "165K", previous: "170K" }),
  cpi("2026-08-12", { forecast: "0.2%", previous: "0.2%" }),

  // September 2026
  nfp("2026-09-04", { forecast: "160K", previous: "165K" }),
  ecb("2026-09-10", "ECB Rate Decision"),
  cpi("2026-09-10", { forecast: "0.2%", previous: "0.2%" }),
  fomc("2026-09-16", "FOMC Rate Decision"),
  fomc("2026-09-16", "Fed Chair Press Conference", { impact: "high" }),

  // October 2026
  nfp("2026-10-02", { forecast: "155K", previous: "160K" }),
  cpi("2026-10-13", { forecast: "0.2%", previous: "0.2%" }),
  ecb("2026-10-29", "ECB Rate Decision"),
  fomc("2026-10-28", "FOMC Rate Decision"),
  fomc("2026-10-28", "Fed Chair Press Conference", { impact: "high" }),
  gdp("2026-10-29", "GDP Q3 Advance"),

  // November 2026
  nfp("2026-11-06", { forecast: "150K", previous: "155K" }),
  cpi("2026-11-12", { forecast: "0.2%", previous: "0.2%" }),

  // December 2026
  nfp("2026-12-04", { forecast: "150K", previous: "150K" }),
  fomc("2026-12-09", "FOMC Rate Decision"),
  fomc("2026-12-09", "Fed Chair Press Conference", { impact: "high" }),
  cpi("2026-12-10", { forecast: "0.2%", previous: "0.2%" }),
  ecb("2026-12-17", "ECB Rate Decision"),
];

function fomc(
  date: string,
  event = "FOMC Rate Decision",
  extras: Partial<EconomicEvent> = {},
): EconomicEvent {
  return {
    date,
    event,
    country: "US",
    currency: "USD",
    impact: "high",
    isFomc: true,
    ...extras,
  };
}

function nfp(
  date: string,
  extras: Partial<EconomicEvent> = {},
): EconomicEvent {
  return {
    date,
    event: "Nonfarm Payrolls",
    country: "US",
    currency: "USD",
    impact: "high",
    isFomc: false,
    ...extras,
  };
}

function cpi(
  date: string,
  extras: Partial<EconomicEvent> = {},
): EconomicEvent {
  return {
    date,
    event: "CPI MoM",
    country: "US",
    currency: "USD",
    impact: "high",
    isFomc: false,
    ...extras,
  };
}

function gdp(
  date: string,
  event: string,
  extras: Partial<EconomicEvent> = {},
): EconomicEvent {
  return {
    date,
    event,
    country: "US",
    currency: "USD",
    impact: "medium",
    isFomc: false,
    ...extras,
  };
}

function ecb(
  date: string,
  event: string,
  extras: Partial<EconomicEvent> = {},
): EconomicEvent {
  return {
    date,
    event,
    country: "EU",
    currency: "EUR",
    impact: "high",
    isFomc: false,
    ...extras,
  };
}

export function loadEconomicEvents(): EconomicEvent[] {
  // Sorted ascending. Caller filters as needed.
  return [...EVENTS].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function highImpactThisWeek(events: EconomicEvent[]): number {
  const today = new Date();
  const monday = startOfWeekUTC(today).getTime();
  const nextMonday = monday + 7 * DAY_MS;
  return events.filter((e) => {
    if (e.impact !== "high") return false;
    const ts = Date.parse(e.date);
    return Number.isFinite(ts) && ts >= monday && ts < nextMonday;
  }).length;
}
