import Link from "next/link";

import {
  flagFor,
  loadEconomicEvents,
  type EconomicEvent,
  type EventImpact,
} from "@/lib/economicCalendar";

export const revalidate = 3600;

const FILTERS = ["all", "high", "this-week", "next-week"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  high: "High impact",
  "this-week": "This week",
  "next-week": "Next week",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function MacroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = (params.filter ?? "all") as string;
  const filter: Filter = (FILTERS as readonly string[]).includes(raw)
    ? (raw as Filter)
    : "all";

  const all = loadEconomicEvents();
  const filtered = applyFilter(all, filter);
  const groups = groupByDate(filtered);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Economic calendar
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Major US and EU macro releases for 2026 — Fed meetings, employment,
          inflation, GDP, and ECB decisions.
        </p>
      </header>

      <FilterTabs active={filter} />

      {groups.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No events match this filter.
        </div>
      ) : (
        groups.map((group) => (
          <DateSection key={group.date} group={group} />
        ))
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Sourced from Fed, BLS, BEA, and ECB published schedules. Forecasts are
        illustrative — verify against your data provider before trading.
      </p>
    </div>
  );
}

function FilterTabs({ active }: { active: Filter }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((f) => (
        <Link
          key={f}
          href={f === "all" ? "/macro" : `/macro?filter=${f}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === f
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-700"
              : "bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-neutral-800"
          }`}
        >
          {FILTER_LABEL[f]}
        </Link>
      ))}
    </div>
  );
}

type DateGroup = {
  date: string;
  events: EconomicEvent[];
};

function DateSection({ group }: { group: DateGroup }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        {formatDateHeader(group.date)}
      </h2>
      <ul className="space-y-2">
        {group.events.map((event, i) => (
          <EventRow key={`${event.date}-${event.event}-${i}`} event={event} />
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <ImpactBadge impact={event.impact} />
        <span aria-hidden className="text-base">
          {flagFor(event.country)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">{event.event}</span>
            {event.isFomc && <FomcBadge />}
            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
              {event.currency}
            </span>
          </div>
        </div>
        {(event.forecast || event.previous) && (
          <div className="flex shrink-0 items-baseline gap-3 text-right text-xs">
            {event.forecast && (
              <Stat label="Forecast" value={event.forecast} emphasis />
            )}
            {event.previous && (
              <Stat label="Previous" value={event.previous} />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div
        className={
          emphasis
            ? "font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100"
            : "font-mono text-sm text-neutral-700 dark:text-neutral-300"
        }
      >
        {value}
      </div>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: EventImpact }) {
  const styles: Record<EventImpact, string> = {
    high: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    medium:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  };
  const label: Record<EventImpact, string> = {
    high: "High",
    medium: "Med",
    low: "Low",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[impact]}`}
    >
      {label[impact]}
    </span>
  );
}

function FomcBadge() {
  return (
    <span
      title="Federal Open Market Committee"
      className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
    >
      FOMC
    </span>
  );
}

function applyFilter(events: EconomicEvent[], filter: Filter): EconomicEvent[] {
  if (filter === "all") return events;
  if (filter === "high") return events.filter((e) => e.impact === "high");

  const today = new Date();
  const monday = startOfWeekUTC(today).getTime();
  const nextMonday = monday + 7 * DAY_MS;
  const followingMonday = nextMonday + 7 * DAY_MS;

  if (filter === "this-week") {
    return events.filter((e) => {
      const ts = Date.parse(e.date);
      return Number.isFinite(ts) && ts >= monday && ts < nextMonday;
    });
  }
  // next-week
  return events.filter((e) => {
    const ts = Date.parse(e.date);
    return Number.isFinite(ts) && ts >= nextMonday && ts < followingMonday;
  });
}

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function groupByDate(events: EconomicEvent[]): DateGroup[] {
  const map = new Map<string, EconomicEvent[]>();
  for (const e of events) {
    let arr = map.get(e.date);
    if (!arr) {
      arr = [];
      map.set(e.date, arr);
    }
    arr.push(e);
  }
  return Array.from(map.entries())
    .map(([date, events]) => ({ date, events }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function formatDateHeader(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
