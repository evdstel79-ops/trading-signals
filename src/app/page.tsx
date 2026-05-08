import Link from "next/link";

import AlertsQuickCount from "@/components/AlertsQuickCount";
import BriefingGreeting from "@/components/BriefingGreeting";
import BriefingPortfolio from "@/components/BriefingPortfolio";
import BriefingThisWeek, {
  type NextMacro,
} from "@/components/BriefingThisWeek";
import EarningsQuickCount from "@/components/EarningsQuickCount";
import NewsQuickCount from "@/components/NewsQuickCount";
import TickerLink from "@/components/TickerLink";
import {
  highImpactThisWeek,
  loadEconomicEvents,
} from "@/lib/economicCalendar";
import { fetchInsiderTrades, type InsiderTrade } from "@/lib/insiderSignals";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes, type Quote } from "@/lib/quotes";
import {
  calculateSignalScore,
  type ScorableTrade,
  type SignalScore,
} from "@/lib/signalScoring";
import { detectCorrelations } from "@/lib/tradeCorrelation";

export const revalidate = 300;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const SECTOR_TICKER_LIMIT = 30;

type CombinedTrade = {
  ticker: string;
  filedAt: string;
  transactionType: "buy" | "sell" | "other";
  scorable: ScorableTrade;
};

export default async function DashboardPage() {
  const [politicalResult, insiderResult] = await Promise.allSettled([
    fetchPoliticalTrades(),
    fetchInsiderTrades(),
  ]);

  const political: PoliticalTrade[] =
    politicalResult.status === "fulfilled" ? politicalResult.value : [];
  const insider: InsiderTrade[] =
    insiderResult.status === "fulfilled" ? insiderResult.value : [];

  const politicalError =
    politicalResult.status === "rejected"
      ? errorMessage(politicalResult.reason)
      : null;
  const insiderError =
    insiderResult.status === "rejected"
      ? errorMessage(insiderResult.reason)
      : null;

  const sevenDayCutoff = Date.now() - SEVEN_DAYS_MS;
  const politicalLast7d = political.filter(
    (t) => parseFiledAt(t.filedAt) >= sevenDayCutoff,
  ).length;
  const insiderLast7d = insider.filter(
    (t) => parseFiledAt(t.filedAt) >= sevenDayCutoff,
  ).length;

  const tickerCounts = new Map<string, number>();
  for (const t of political) {
    if (t.ticker) tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) ?? 0) + 1);
  }
  for (const t of insider) {
    if (t.ticker) tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) ?? 0) + 1);
  }
  const topTicker = [...tickerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const data = await computeDashboardData(political, insider);
  const allMacroEvents = loadEconomicEvents();
  const macroHighImpact = highImpactThisWeek(allMacroEvents);

  const todayStr = new Date().toISOString().slice(0, 10);
  const politicalToday = political.filter(
    (t) => t.filedAt.slice(0, 10) === todayStr,
  ).length;
  const insiderToday = insider.filter(
    (t) => t.filedAt.slice(0, 10) === todayStr,
  ).length;

  const nextMacro: NextMacro =
    allMacroEvents
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
  const briefingNextMacro: NextMacro = nextMacro
    ? {
        event: nextMacro.event,
        date: nextMacro.date,
        isFomc: nextMacro.isFomc,
      }
    : null;

  const lastUpdated = new Date();
  const lastUpdatedLabel = lastUpdated.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-8">
      <BriefingGreeting />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Today&apos;s briefing
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <NewTodayCard
            politicalToday={politicalToday}
            insiderToday={insiderToday}
          />
          <BriefingPortfolio />
          <BriefingThisWeek nextMacro={briefingNextMacro} />
        </div>
        <TopSignalHighlight signal={data.topSignal} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Quick access
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAccessCard
            href="/signals"
            icon="📊"
            title="Signals"
            subtitle={
              data.topSignal ? (
                <>
                  Top:{" "}
                  <span className="font-mono font-semibold">
                    {data.topSignal.ticker}
                  </span>{" "}
                  · score {data.topSignal.score.score.toFixed(1)}
                </>
              ) : (
                "Tickers ranked by signal strength"
              )
            }
          />
          <QuickAccessCard
            href="/correlations"
            icon="🔗"
            title="Correlations"
            subtitle={
              data.correlationCount > 0
                ? `${data.correlationCount} active correlation${data.correlationCount === 1 ? "" : "s"}`
                : "Tickers traded by multiple members"
            }
          />
          <QuickAccessCard
            href="/compare"
            icon="⚖️"
            title="Compare"
            subtitle="Pick two tickers"
          />
          <QuickAccessCard
            href="/politicians"
            icon="🏛️"
            title="Politicians"
            subtitle={
              data.topPolitician
                ? `Top: ${data.topPolitician.name} · ${data.topPolitician.count} trade${data.topPolitician.count === 1 ? "" : "s"}`
                : "Members ranked by trading return"
            }
          />
          <QuickAccessCard
            href="/insiders"
            icon="👔"
            title="Insiders"
            subtitle={
              data.topInsider
                ? `Top buyer: ${data.topInsider.name} · ${data.topInsider.buys} buy${data.topInsider.buys === 1 ? "" : "s"}`
                : "Corporate insiders ranked by buys"
            }
          />
          <QuickAccessCard
            href="/alerts"
            icon="🔔"
            title="Alerts"
            subtitle={<AlertsQuickCount />}
          />
          <QuickAccessCard
            href="/news"
            icon="📰"
            title="News"
            subtitle={<NewsQuickCount />}
          />
          <QuickAccessCard
            href="/earnings"
            icon="📅"
            title="Earnings"
            subtitle={<EarningsQuickCount />}
          />
          <QuickAccessCard
            href="/macro"
            icon="📊"
            title="Macro"
            subtitle={
              macroHighImpact > 0
                ? `${macroHighImpact} high-impact event${macroHighImpact === 1 ? "" : "s"} this week`
                : "No high-impact events this week"
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            href="/political-trades"
            label="Political trades (7d)"
            value={
              politicalError ? "—" : politicalLast7d.toLocaleString("en-US")
            }
            hint={
              politicalError
                ? "Source unavailable"
                : `${political.length} loaded · capitoltrades.com`
            }
            error={politicalError}
          />
          <StatCard
            href="/insider-trades"
            label="Insider trades (7d)"
            value={insiderError ? "—" : insiderLast7d.toLocaleString("en-US")}
            hint={
              insiderError
                ? "Source unavailable"
                : `${insider.length} loaded · SEC EDGAR`
            }
            error={insiderError}
          />
          <StatCard
            href={topTicker ? `/ticker/${encodeURIComponent(topTicker[0])}` : undefined}
            label="Top ticker"
            value={topTicker ? topTicker[0] : "—"}
            hint={
              topTicker
                ? `${topTicker[1]} signals across both sources`
                : "Not enough data"
            }
          />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Last updated {lastUpdatedLabel} UTC · refreshes every 5 min
        </p>
      </section>
    </div>
  );
}

type DashboardData = {
  newFilings: number;
  topSignal: { ticker: string; score: SignalScore } | null;
  bullishSector: { name: string; count: number } | null;
  bearishSector: { name: string; count: number } | null;
  topPolitician: { name: string; count: number } | null;
  topInsider: { name: string; buys: number } | null;
  correlationCount: number;
};

async function computeDashboardData(
  political: PoliticalTrade[],
  insider: InsiderTrade[],
): Promise<DashboardData> {
  const dayCutoff = Date.now() - ONE_DAY_MS;
  const weekCutoff = Date.now() - SEVEN_DAYS_MS;

  const combined: CombinedTrade[] = [];
  for (const p of political) {
    if (!p.ticker) continue;
    combined.push({
      ticker: p.ticker.toUpperCase(),
      filedAt: p.filedAt,
      transactionType:
        p.transactionType === "buy"
          ? "buy"
          : p.transactionType === "sell"
            ? "sell"
            : "other",
      scorable: {
        filedAt: p.filedAt,
        amount: p.value,
        direction:
          p.transactionType === "buy"
            ? "buy"
            : p.transactionType === "sell"
              ? "sell"
              : "other",
        trader: p.memberName,
      },
    });
  }
  for (const i of insider) {
    if (!i.ticker) continue;
    combined.push({
      ticker: i.ticker.toUpperCase(),
      filedAt: i.filedAt,
      transactionType: i.transactionType,
      scorable: {
        filedAt: i.filedAt,
        amount: i.value,
        direction: i.transactionType,
        trader: i.insiderName,
      },
    });
  }

  // 1) New filings — political + insider in the last 24h.
  const newFilings = combined.filter(
    (t) => parseFiledAt(t.filedAt) >= dayCutoff,
  ).length;

  // 2) Top mover — ticker with the highest signal score from the scoring system.
  const byTicker = new Map<string, ScorableTrade[]>();
  for (const t of combined) {
    let arr = byTicker.get(t.ticker);
    if (!arr) {
      arr = [];
      byTicker.set(t.ticker, arr);
    }
    arr.push(t.scorable);
  }
  let topSignal: DashboardData["topSignal"] = null;
  for (const [ticker, trades] of byTicker) {
    const score = calculateSignalScore(trades);
    if (score.score === 0) continue;
    if (!topSignal || score.score > topSignal.score.score) {
      topSignal = { ticker, score };
    }
  }

  // 3) + 4) Bullish/bearish sectors — buys vs sells in the last 7 days, by sector.
  const last7d = combined.filter(
    (t) => parseFiledAt(t.filedAt) >= weekCutoff,
  );
  const tickerFreq7d = new Map<string, number>();
  for (const t of last7d) {
    tickerFreq7d.set(t.ticker, (tickerFreq7d.get(t.ticker) ?? 0) + 1);
  }
  const sectorTickers = [...tickerFreq7d.keys()]
    .sort((a, b) => (tickerFreq7d.get(b) ?? 0) - (tickerFreq7d.get(a) ?? 0))
    .slice(0, SECTOR_TICKER_LIMIT);

  let quotes: Record<string, Quote | null> = {};
  if (sectorTickers.length > 0) {
    try {
      quotes = await fetchQuotes(sectorTickers);
    } catch {
      // Soft-fail; sector tallies just won't be enriched.
    }
  }

  const buys = new Map<string, number>();
  const sells = new Map<string, number>();
  for (const t of last7d) {
    const sector = quotes[t.ticker]?.sector;
    if (!sector) continue;
    if (t.transactionType === "buy") {
      buys.set(sector, (buys.get(sector) ?? 0) + 1);
    } else if (t.transactionType === "sell") {
      sells.set(sector, (sells.get(sector) ?? 0) + 1);
    }
  }
  const bullishSector = topEntry(buys);
  const bearishSector = topEntry(sells);

  // 5) Top politician by trade count.
  const polCounts = new Map<string, number>();
  for (const p of political) {
    if (!p.memberName) continue;
    polCounts.set(p.memberName, (polCounts.get(p.memberName) ?? 0) + 1);
  }
  const topPoliticianEntry = topEntry(polCounts);
  const topPolitician = topPoliticianEntry
    ? { name: topPoliticianEntry.name, count: topPoliticianEntry.count }
    : null;

  // 6) Top insider by buy count.
  const insBuyCounts = new Map<string, number>();
  for (const i of insider) {
    if (!i.insiderName || i.transactionType !== "buy") continue;
    insBuyCounts.set(
      i.insiderName,
      (insBuyCounts.get(i.insiderName) ?? 0) + 1,
    );
  }
  const topInsiderEntry = topEntry(insBuyCounts);
  const topInsider = topInsiderEntry
    ? { name: topInsiderEntry.name, buys: topInsiderEntry.count }
    : null;

  // 7) Active correlations.
  let correlationCount = 0;
  try {
    correlationCount = detectCorrelations(political).length;
  } catch {
    correlationCount = 0;
  }

  return {
    newFilings,
    topSignal,
    bullishSector,
    bearishSector,
    topPolitician,
    topInsider,
    correlationCount,
  };
}

function topEntry(
  m: Map<string, number>,
): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of m) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function NewTodayCard({
  politicalToday,
  insiderToday,
}: {
  politicalToday: number;
  insiderToday: number;
}) {
  const total = politicalToday + insiderToday;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        New today
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No new filings today
        </p>
      ) : (
        <>
          <div className="mt-2 text-2xl font-semibold">
            {total.toLocaleString("en-US")}{" "}
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              filings
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <Link
              href="/political-trades"
              className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
            >
              {politicalToday} political
            </Link>{" "}
            ·{" "}
            <Link
              href="/insider-trades"
              className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
            >
              {insiderToday} insider
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function TopSignalHighlight({
  signal,
}: {
  signal: { ticker: string; score: SignalScore } | null;
}) {
  if (!signal) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No signal data yet.
      </div>
    );
  }

  const dir = signal.score.direction;
  const wrapperClass =
    dir === "bullish"
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/40 dark:to-neutral-900"
      : dir === "bearish"
        ? "border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-900 dark:from-red-950/40 dark:to-neutral-900"
        : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900";
  const dirBadgeClass =
    dir === "bullish"
      ? "bg-emerald-600 text-white"
      : dir === "bearish"
        ? "bg-red-600 text-white"
        : "bg-neutral-300 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300";
  const scoreClass =
    dir === "bullish"
      ? "text-emerald-700 dark:text-emerald-300"
      : dir === "bearish"
        ? "text-red-700 dark:text-red-300"
        : "text-neutral-700 dark:text-neutral-300";

  return (
    <Link
      href={`/ticker/${encodeURIComponent(signal.ticker)}`}
      className={`flex flex-wrap items-center gap-4 rounded-lg border-2 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${wrapperClass}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Top signal right now
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-3xl font-bold tracking-tight">
          {signal.ticker}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${dirBadgeClass}`}
        >
          {dir}
        </span>
      </div>
      <div className="ml-auto flex items-baseline gap-1.5 text-right">
        <span className={`font-mono text-2xl font-bold tabular-nums ${scoreClass}`}>
          {signal.score.score.toFixed(1)}
        </span>
        <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          score
        </span>
      </div>
      <span
        aria-hidden
        className="text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600"
      >
        →
      </span>
    </Link>
  );
}

function QuickAccessCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-600"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-lg dark:bg-neutral-800"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-neutral-900 group-hover:text-emerald-700 dark:text-neutral-100 dark:group-hover:text-emerald-300">
          {title}
        </div>
        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </div>
      </div>
      <span
        aria-hidden
        className="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-neutral-600 dark:group-hover:text-emerald-400"
      >
        →
      </span>
    </Link>
  );
}

function StatCard({
  label,
  value,
  hint,
  error,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  error?: string | null;
  href?: string;
}) {
  const cardClass =
    "block rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";
  const hoverClass = href
    ? "transition-colors hover:border-emerald-500 dark:hover:border-emerald-600"
    : "";
  const inner = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div
        className={`mt-1 text-xs ${
          error
            ? "text-red-600 dark:text-red-400"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
        title={error ?? undefined}
      >
        {hint}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${cardClass} ${hoverClass}`}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}

function parseFiledAt(s: string): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return "Unknown error";
}
