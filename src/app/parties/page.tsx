import Link from "next/link";

import PartyComparisonChart, {
  type ComparisonMetric,
  type SectorRow,
} from "@/components/PartyComparisonChart";
import TickerLink from "@/components/TickerLink";
import {
  fetchPoliticalTrades,
  type Party,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes } from "@/lib/quotes";

export const revalidate = 300;

const TOP_TICKERS_LIMIT = 5;
const TOP_POLITICIANS_LIMIT = 5;
const TOP_SECTORS_FOR_CARDS = 3;
const TOP_SECTORS_FOR_CHART = 6;

const PARTY_LABEL: Record<Party, string> = {
  R: "Republicans",
  D: "Democrats",
  I: "Independents",
  Unknown: "Unknown",
};

type PartyStats = {
  party: Party;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  buyPct: number;
  uniquePoliticians: number;
  uniqueTickers: number;
  topTickers: { ticker: string; count: number }[];
  topPoliticians: { name: string; count: number }[];
  /** Full sector → buy-trade count map (used by both cards and chart). */
  sectorCounts: Map<string, number>;
  /** Top-N sectors ready for the hero card. */
  topSectors: { sector: string; count: number }[];
  mostActive: { name: string; count: number } | null;
  modalAmount: string | null;
};

export default async function PartiesPage() {
  let political: PoliticalTrade[] = [];
  let tradesError: string | null = null;
  try {
    political = await fetchPoliticalTrades();
  } catch (e) {
    tradesError = e instanceof Error ? e.message : "Unknown error";
  }

  const tickers = Array.from(
    new Set(political.map((t) => t.ticker).filter(Boolean)),
  );
  const quotes = tickers.length > 0 ? await fetchQuotes(tickers) : {};
  const tickerToSector = new Map<string, string>();
  for (const ticker of Object.keys(quotes)) {
    const sector = quotes[ticker]?.sector;
    if (sector) tickerToSector.set(ticker, sector);
  }

  const groups: Record<Party, PoliticalTrade[]> = {
    R: [],
    D: [],
    I: [],
    Unknown: [],
  };
  for (const trade of political) {
    groups[trade.party].push(trade);
  }

  const republican = computePartyStats("R", groups.R, tickerToSector);
  const democrat = computePartyStats("D", groups.D, tickerToSector);
  const independent = computePartyStats(
    "I",
    [...groups.I, ...groups.Unknown],
    tickerToSector,
  );

  const metrics: ComparisonMetric[] = [
    {
      label: "Total trades",
      rValue: republican.totalTrades,
      dValue: democrat.totalTrades,
      format: "number",
    },
    {
      label: "Buy %",
      rValue: republican.buyPct,
      dValue: democrat.buyPct,
      format: "percent",
    },
    {
      label: "Unique tickers",
      rValue: republican.uniqueTickers,
      dValue: democrat.uniqueTickers,
      format: "number",
    },
    {
      label: "Unique politicians",
      rValue: republican.uniquePoliticians,
      dValue: democrat.uniquePoliticians,
      format: "number",
    },
  ];

  const { sectorRows, sectorOrder } = buildSectorChartData(
    republican,
    democrat,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Parties</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Republicans vs. Democrats — disclosed trading activity, sector
          allocation, and the most active members in each caucus.
        </p>
      </header>

      {tradesError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Political trades: {tradesError}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PartyHero
          stats={republican}
          accent="rose"
          partyLabel="Republicans"
        />
        <PartyHero stats={democrat} accent="blue" partyLabel="Democrats" />
      </section>

      <PartyComparisonChart
        metrics={metrics}
        sectorData={sectorRows}
        sectors={sectorOrder}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList
          title="Top tickers · Republicans"
          accent="rose"
          items={republican.topTickers.map((t) => ({
            primary: <TickerLink ticker={t.ticker} />,
            secondary: `${t.count} buy${t.count === 1 ? "" : "s"}`,
          }))}
          empty="No buy trades found."
        />
        <TopList
          title="Top tickers · Democrats"
          accent="blue"
          items={democrat.topTickers.map((t) => ({
            primary: <TickerLink ticker={t.ticker} />,
            secondary: `${t.count} buy${t.count === 1 ? "" : "s"}`,
          }))}
          empty="No buy trades found."
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList
          title="Top politicians · Republicans"
          accent="rose"
          items={republican.topPoliticians.map((p) => ({
            primary: (
              <Link
                href={`/politicians/${encodeURIComponent(p.name)}`}
                className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
              >
                {p.name}
              </Link>
            ),
            secondary: `${p.count} trade${p.count === 1 ? "" : "s"}`,
          }))}
          empty="No trades found."
        />
        <TopList
          title="Top politicians · Democrats"
          accent="blue"
          items={democrat.topPoliticians.map((p) => ({
            primary: (
              <Link
                href={`/politicians/${encodeURIComponent(p.name)}`}
                className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
              >
                {p.name}
              </Link>
            ),
            secondary: `${p.count} trade${p.count === 1 ? "" : "s"}`,
          }))}
          empty="No trades found."
        />
      </section>

      {independent.totalTrades > 0 && (
        <section>
          <PartyHero
            stats={independent}
            accent="purple"
            partyLabel="Independents / unaffiliated"
            small
          />
        </section>
      )}
    </div>
  );
}

type Accent = "rose" | "blue" | "purple";

const ACCENT_BORDER: Record<Accent, string> = {
  rose: "border-red-200 dark:border-red-900",
  blue: "border-blue-200 dark:border-blue-900",
  purple: "border-purple-200 dark:border-purple-900",
};
const ACCENT_BAR: Record<Accent, string> = {
  rose: "bg-red-600",
  blue: "bg-blue-600",
  purple: "bg-purple-600",
};
const ACCENT_TEXT: Record<Accent, string> = {
  rose: "text-red-700 dark:text-red-300",
  blue: "text-blue-700 dark:text-blue-300",
  purple: "text-purple-700 dark:text-purple-300",
};

function PartyHero({
  stats,
  accent,
  partyLabel,
  small = false,
}: {
  stats: PartyStats;
  accent: Accent;
  partyLabel: string;
  small?: boolean;
}) {
  if (stats.totalTrades === 0) {
    return (
      <div
        className={`rounded-lg border-2 ${ACCENT_BORDER[accent]} bg-white p-5 dark:bg-neutral-900`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${ACCENT_BAR[accent]}`}
          />
          <h2 className={`text-base font-semibold ${ACCENT_TEXT[accent]}`}>
            {partyLabel}
          </h2>
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No trades disclosed in the loaded window.
        </p>
      </div>
    );
  }

  const ratio =
    stats.sellCount > 0
      ? `${stats.buyCount}:${stats.sellCount}`
      : `${stats.buyCount}:0`;

  return (
    <div
      className={`rounded-lg border-2 ${ACCENT_BORDER[accent]} bg-white p-5 dark:bg-neutral-900`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${ACCENT_BAR[accent]}`}
        />
        <h2 className={`text-base font-semibold ${ACCENT_TEXT[accent]}`}>
          {partyLabel}
        </h2>
      </div>
      <div className={`mt-2 ${small ? "text-2xl" : "text-3xl"} font-semibold`}>
        {stats.totalTrades.toLocaleString("en-US")}
        <span className="ml-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          trades
        </span>
      </div>
      <dl
        className={`mt-3 grid ${small ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-3 text-sm`}
      >
        <Stat
          label="Buy / Sell"
          value={
            <span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {stats.buyCount}
              </span>
              {" / "}
              <span className="text-red-600 dark:text-red-400">
                {stats.sellCount}
              </span>
              <span className="ml-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                ({ratio})
              </span>
            </span>
          }
        />
        <Stat label="Politicians" value={stats.uniquePoliticians.toString()} />
        <Stat label="Tickers" value={stats.uniqueTickers.toString()} />
        {stats.mostActive && (
          <Stat
            label="Most active"
            value={
              <Link
                href={`/politicians/${encodeURIComponent(stats.mostActive.name)}`}
                className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
              >
                {stats.mostActive.name}
              </Link>
            }
            hint={`${stats.mostActive.count} trades`}
          />
        )}
        <Stat
          label="Top sectors"
          value={
            stats.topSectors.length > 0 ? (
              <span className="text-xs">
                {stats.topSectors.map((s) => s.sector).join(", ")}
              </span>
            ) : (
              <span className="text-neutral-400">—</span>
            )
          }
        />
        {stats.modalAmount && (
          <Stat label="Avg trade size" value={stats.modalAmount} />
        )}
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
      {hint && (
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function TopList({
  title,
  accent,
  items,
  empty,
}: {
  title: string;
  accent: Accent;
  items: { primary: React.ReactNode; secondary: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${ACCENT_BAR[accent]}`}
        />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {empty}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="flex items-baseline gap-2 truncate">
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-600">
                  {i + 1}.
                </span>
                <span className="truncate">{item.primary}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                {item.secondary}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function computePartyStats(
  party: Party,
  trades: PoliticalTrade[],
  tickerToSector: Map<string, string>,
): PartyStats {
  let buyCount = 0;
  let sellCount = 0;
  const tickers = new Set<string>();
  const politicians = new Set<string>();
  const buyTickerCounts = new Map<string, number>();
  const politicianCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();
  const amountCounts = new Map<string, number>();

  for (const t of trades) {
    if (t.transactionType === "buy") buyCount++;
    else if (t.transactionType === "sell") sellCount++;
    if (t.ticker) tickers.add(t.ticker);
    if (t.memberName) {
      politicians.add(t.memberName);
      politicianCounts.set(
        t.memberName,
        (politicianCounts.get(t.memberName) ?? 0) + 1,
      );
    }
    if (t.transactionType === "buy" && t.ticker) {
      buyTickerCounts.set(
        t.ticker,
        (buyTickerCounts.get(t.ticker) ?? 0) + 1,
      );
      const sector = tickerToSector.get(t.ticker.toUpperCase());
      if (sector) {
        sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
      }
    }
    if (t.amount && t.amount !== "—") {
      amountCounts.set(t.amount, (amountCounts.get(t.amount) ?? 0) + 1);
    }
  }

  const total = trades.length;
  const buyPct = total > 0 ? (buyCount / total) * 100 : 0;

  const topTickers = topN(buyTickerCounts, TOP_TICKERS_LIMIT).map(
    ([ticker, count]) => ({ ticker, count }),
  );
  const topPoliticians = topN(politicianCounts, TOP_POLITICIANS_LIMIT).map(
    ([name, count]) => ({ name, count }),
  );
  const topSectors = topN(sectorCounts, TOP_SECTORS_FOR_CARDS).map(
    ([sector, count]) => ({ sector, count }),
  );
  const mostActiveEntry = topN(politicianCounts, 1)[0] ?? null;
  const modalAmountEntry = topN(amountCounts, 1)[0] ?? null;

  return {
    party,
    totalTrades: total,
    buyCount,
    sellCount,
    buyPct,
    uniquePoliticians: politicians.size,
    uniqueTickers: tickers.size,
    topTickers,
    topPoliticians,
    sectorCounts,
    topSectors,
    mostActive: mostActiveEntry
      ? { name: mostActiveEntry[0], count: mostActiveEntry[1] }
      : null,
    modalAmount: modalAmountEntry ? modalAmountEntry[0] : null,
  };
}

function topN(m: Map<string, number>, n: number): [string, number][] {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function buildSectorChartData(
  republican: PartyStats,
  democrat: PartyStats,
): { sectorRows: SectorRow[]; sectorOrder: string[] } {
  const combined = new Map<string, number>();
  for (const [sector, count] of republican.sectorCounts) {
    combined.set(sector, (combined.get(sector) ?? 0) + count);
  }
  for (const [sector, count] of democrat.sectorCounts) {
    combined.set(sector, (combined.get(sector) ?? 0) + count);
  }
  const sectorOrder = topN(combined, TOP_SECTORS_FOR_CHART).map(([s]) => s);

  const rRow: SectorRow = { party: PARTY_LABEL.R };
  const dRow: SectorRow = { party: PARTY_LABEL.D };
  for (const sector of sectorOrder) {
    rRow[sector] = republican.sectorCounts.get(sector) ?? 0;
    dRow[sector] = democrat.sectorCounts.get(sector) ?? 0;
  }

  return { sectorRows: [rRow, dRow], sectorOrder };
}
