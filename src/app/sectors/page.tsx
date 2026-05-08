import Link from "next/link";

import SectorRotationChart, {
  type SectorTotal,
  type SectorWeekly,
} from "@/components/SectorRotationChart";
import TickerLink from "@/components/TickerLink";
import TradeHeatmap from "@/components/TradeHeatmap";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes } from "@/lib/quotes";

export const revalidate = 300;

type ExtendedTotal = SectorTotal & {
  netSentiment: number;
  topTicker: string | null;
  topPolitician: string | null;
};

type SectorBucket = {
  buyCount: number;
  sellCount: number;
  totalTrades: number;
  byTicker: Map<string, number>;
  byPolitician: Map<string, number>;
};

type WeekBucket = { buyCount: number; sellCount: number };

export default async function SectorsPage() {
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

  const sectorMap = new Map<string, SectorBucket>();
  const weeklyMap = new Map<string, Map<string, WeekBucket>>();

  for (const trade of political) {
    if (!trade.ticker) continue;
    const sector = tickerToSector.get(trade.ticker.toUpperCase());
    if (!sector) continue;

    let entry = sectorMap.get(sector);
    if (!entry) {
      entry = {
        buyCount: 0,
        sellCount: 0,
        totalTrades: 0,
        byTicker: new Map(),
        byPolitician: new Map(),
      };
      sectorMap.set(sector, entry);
    }
    entry.totalTrades++;
    if (trade.transactionType === "buy") entry.buyCount++;
    else if (trade.transactionType === "sell") entry.sellCount++;
    entry.byTicker.set(
      trade.ticker,
      (entry.byTicker.get(trade.ticker) ?? 0) + 1,
    );
    if (trade.memberName) {
      entry.byPolitician.set(
        trade.memberName,
        (entry.byPolitician.get(trade.memberName) ?? 0) + 1,
      );
    }

    const week = mondayOfWeek(trade.filedAt);
    if (!week) continue;
    let weekMap = weeklyMap.get(sector);
    if (!weekMap) {
      weekMap = new Map();
      weeklyMap.set(sector, weekMap);
    }
    let bucket = weekMap.get(week);
    if (!bucket) {
      bucket = { buyCount: 0, sellCount: 0 };
      weekMap.set(week, bucket);
    }
    if (trade.transactionType === "buy") bucket.buyCount++;
    else if (trade.transactionType === "sell") bucket.sellCount++;
  }

  const totals: ExtendedTotal[] = Array.from(sectorMap.entries())
    .map(([sector, info]) => ({
      sector,
      buyCount: info.buyCount,
      sellCount: info.sellCount,
      totalTrades: info.totalTrades,
      netSentiment: info.buyCount - info.sellCount,
      topTicker: topKey(info.byTicker),
      topPolitician: topKey(info.byPolitician),
    }))
    .sort((a, b) => b.totalTrades - a.totalTrades);

  const weeklySeries: SectorWeekly[] = Array.from(weeklyMap.entries()).map(
    ([sector, weekMap]) => ({
      sector,
      points: Array.from(weekMap.entries())
        .map(([week, c]) => ({
          week,
          buyCount: c.buyCount,
          sellCount: c.sellCount,
        }))
        .sort((a, b) =>
          a.week < b.week ? -1 : a.week > b.week ? 1 : 0,
        ),
    }),
  );

  const skipped = political.filter((t) => t.ticker).length -
    Array.from(sectorMap.values()).reduce((s, b) => s + b.totalTrades, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sector rotation
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Where Congress is putting money to work, grouped by sector.
          {skipped > 0 && (
            <span className="ml-1 text-xs">
              ({skipped} trade{skipped === 1 ? "" : "s"} skipped — sector
              unknown)
            </span>
          )}
        </p>
      </header>

      {tradesError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Political trades: {tradesError}
        </div>
      )}

      {totals.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No sector-tagged trades available.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold">Trading activity</h2>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Political trade filings over the last 26 weeks.
            </p>
            <div className="mt-3">
              <TradeHeatmap
                compact
                trades={political.map((t) => ({
                  date: t.filedAt,
                  ticker: t.ticker,
                }))}
              />
            </div>
          </div>

          <SectorRotationChart totals={totals} weekly={weeklySeries} />

          <section>
            <h2 className="mb-3 text-base font-semibold">
              Sector breakdown ({totals.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {totals.map((t) => (
                <SectorCard key={t.sector} total={t} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SectorCard({ total }: { total: ExtendedTotal }) {
  const ratio =
    total.sellCount > 0
      ? `${total.buyCount}:${total.sellCount}`
      : `${total.buyCount}:0`;
  const sentiment =
    total.netSentiment > 0
      ? "bullish"
      : total.netSentiment < 0
        ? "bearish"
        : "neutral";
  const sentimentClass =
    sentiment === "bullish"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : sentiment === "bearish"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-semibold">{total.sector}</h3>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sentimentClass}`}
          title={`Net sentiment ${total.netSentiment >= 0 ? "+" : ""}${total.netSentiment}`}
        >
          {sentiment}
        </span>
      </div>
      <dl className="space-y-1.5 text-sm">
        <Row label="Total trades" value={total.totalTrades.toString()} />
        <Row
          label="Buy / Sell"
          value={
            <span className="font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">
                {total.buyCount}
              </span>
              {" / "}
              <span className="text-red-600 dark:text-red-400">
                {total.sellCount}
              </span>
              <span className="ml-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                ({ratio})
              </span>
            </span>
          }
        />
        <Row
          label="Top ticker"
          value={
            total.topTicker ? (
              <span className="font-mono text-xs">
                <TickerLink ticker={total.topTicker} />
              </span>
            ) : (
              <span className="text-neutral-400">—</span>
            )
          }
        />
        <Row
          label="Top politician"
          value={
            total.topPolitician ? (
              <Link
                href={`/politicians/${encodeURIComponent(total.topPolitician)}`}
                className="text-xs hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
              >
                {total.topPolitician}
              </Link>
            ) : (
              <span className="text-neutral-400">—</span>
            )
          }
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

function topKey(m: Map<string, number>): string | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of m) {
    if (!best || count > best.count) best = { key, count };
  }
  return best?.key ?? null;
}

/** Floor a YYYY-MM-DD or ISO date to the Monday of its ISO week (UTC). */
function mondayOfWeek(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
