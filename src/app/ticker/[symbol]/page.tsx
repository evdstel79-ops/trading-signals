import Link from "next/link";
import { notFound } from "next/navigation";
import EarningsHistoryChart from "@/components/EarningsHistoryChart";
import TickerActions from "@/components/TickerActions";
import TickerChart, {
  type ChartTradeMarker,
} from "@/components/TickerChart";
import {
  fetchInsiderTrades,
  type InsiderTrade,
} from "@/lib/insiderSignals";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { fetchQuotes, type Quote } from "@/lib/quotes";
import {
  fetchTickerFinancials,
  type RecommendationKey,
  type TickerFinancials,
} from "@/lib/tickerFinancials";
import {
  fetchTickerHistory,
  type HistoryPoint,
  type HistoryRange,
} from "@/lib/tickerHistory";
import { fetchTickerNews, type NewsItem } from "@/lib/tickerNews";

export const revalidate = 300;

const INITIAL_RANGE: HistoryRange = "1mo";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat("en-US");

export default async function TickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const ticker = decodeURIComponent(raw).toUpperCase();
  if (!ticker || !/^[A-Z][A-Z0-9.\-]*$/.test(ticker)) notFound();

  const [
    quotesRes,
    historyRes,
    newsRes,
    politicalRes,
    insiderRes,
    financialsRes,
  ] = await Promise.allSettled([
    fetchQuotes([ticker]),
    fetchTickerHistory(ticker, INITIAL_RANGE),
    fetchTickerNews(ticker),
    fetchPoliticalTrades(),
    fetchInsiderTrades(),
    fetchTickerFinancials(ticker),
  ]);

  const quote: Quote | null =
    quotesRes.status === "fulfilled" ? quotesRes.value[ticker] ?? null : null;
  const history: HistoryPoint[] =
    historyRes.status === "fulfilled" ? historyRes.value : [];
  const news: NewsItem[] = newsRes.status === "fulfilled" ? newsRes.value : [];
  const politicalAll: PoliticalTrade[] =
    politicalRes.status === "fulfilled" ? politicalRes.value : [];
  const insiderAll: InsiderTrade[] =
    insiderRes.status === "fulfilled" ? insiderRes.value : [];
  const financials: TickerFinancials | null =
    financialsRes.status === "fulfilled" ? financialsRes.value : null;

  const political = politicalAll.filter(
    (t) => t.ticker.toUpperCase() === ticker,
  );
  const insider = insiderAll.filter(
    (t) => t.ticker.toUpperCase() === ticker,
  );

  const tradeMarkers: ChartTradeMarker[] = [
    ...political.map(
      (t): ChartTradeMarker => ({
        date: t.txDate || t.filedAt,
        side:
          t.transactionType === "buy"
            ? "buy"
            : t.transactionType === "sell"
              ? "sell"
              : "other",
        source: "political",
        label: t.memberName,
      }),
    ),
    ...insider.map(
      (t): ChartTradeMarker => ({
        date: t.filedAt,
        side: t.transactionType,
        source: "insider",
        label: t.insiderName,
      }),
    ),
  ];

  const dayChange =
    quote && quote.previousClose && quote.previousClose > 0
      ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/signals"
          className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← All signals
        </Link>
        <header className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {ticker}
          </h1>
          {quote?.longname && (
            <span className="text-base text-neutral-600 dark:text-neutral-400">
              {quote.longname}
            </span>
          )}
          {quote?.sector && (
            <span className="text-xs text-neutral-500 dark:text-neutral-500">
              · {quote.sector}
            </span>
          )}
          <Link
            href={`/compare?a=${encodeURIComponent(ticker)}`}
            className="ml-auto inline-flex items-center rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          >
            Compare with…
          </Link>
        </header>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold">
            {quote ? currencyFmt.format(quote.price) : "—"}
          </span>
          {dayChange !== null && (
            <span
              className={`text-base font-medium ${
                dayChange > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : dayChange < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-neutral-500"
              }`}
            >
              {dayChange >= 0 ? "+" : ""}
              {dayChange.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      <TickerChart
        ticker={ticker}
        initialHistory={history}
        initialRange={INITIAL_RANGE}
        trades={tradeMarkers}
      />

      {financials && <KeyStatistics financials={financials} />}
      {financials && (
        <AnalystRatings
          financials={financials}
          ticker={ticker}
          currentPrice={quote?.price ?? null}
        />
      )}
      {financials && financials.earningsHistory.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Earnings history</h2>
          <EarningsHistoryChart history={financials.earningsHistory} />
        </section>
      )}

      <NewsSection items={news} />

      <PoliticalTradesTable trades={political} />
      <InsiderTradesTable trades={insider} />
    </div>
  );
}

function NewsSection({ items }: { items: NewsItem[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        Recent news ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No recent news for this ticker.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-emerald-500 hover:bg-emerald-50/30 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20"
              >
                {item.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium leading-snug">
                    {item.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {item.publisher || "Yahoo Finance"}
                    </span>
                    {item.publishedAt && <span>· {formatRelative(item.publishedAt)}</span>}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PoliticalTradesTable({ trades }: { trades: PoliticalTrade[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        Political trades ({trades.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filed</th>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Chamber</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">Trade price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {trades.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No political trades found for this ticker.
                </td>
              </tr>
            )}
            {trades.map((t, i) => (
              <tr
                key={`${t.filedAt}-${t.memberName}-${i}`}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {t.filedAt}
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/politicians/${encodeURIComponent(t.memberName)}`}
                    className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
                  >
                    {t.memberName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {t.chamber}
                </td>
                <td className="px-4 py-3">
                  <SideBadge side={t.transactionType} />
                </td>
                <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                  {t.amount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {t.tradePrice ? currencyFmt.format(t.tradePrice) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InsiderTradesTable({ trades }: { trades: InsiderTrade[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        Insider trades ({trades.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filed</th>
              <th className="px-4 py-3 font-medium">Insider</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Shares</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {trades.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No insider trades found for this ticker.
                </td>
              </tr>
            )}
            {trades.map((t, i) => (
              <tr
                key={`${t.filingUrl}-${i}`}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {t.filedAt}
                </td>
                <td className="px-4 py-3 font-medium">{t.insiderName}</td>
                <td className="px-4 py-3">
                  <SideBadge side={t.transactionType} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {t.shares ? numberFmt.format(Math.round(t.shares)) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {t.value ? currencyFmt.format(t.value) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SideBadge({ side }: { side: string }) {
  const styles =
    side === "buy"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : side === "sell"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {side}
    </span>
  );
}

const compactNumberFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function KeyStatistics({ financials }: { financials: TickerFinancials }) {
  const stats: { label: string; value: string }[] = [
    {
      label: "Market cap",
      value:
        financials.marketCap !== null
          ? "$" + compactNumberFmt.format(financials.marketCap)
          : "—",
    },
    {
      label: "P/E ratio",
      value:
        financials.peRatio !== null ? financials.peRatio.toFixed(2) : "—",
    },
    {
      label: "Forward P/E",
      value:
        financials.forwardPE !== null ? financials.forwardPE.toFixed(2) : "—",
    },
    {
      label: "EPS (TTM)",
      value:
        financials.eps !== null
          ? currencyFmt.format(financials.eps)
          : "—",
    },
    {
      label: "52-week high",
      value:
        financials.fiftyTwoWeekHigh !== null
          ? currencyFmt.format(financials.fiftyTwoWeekHigh)
          : "—",
    },
    {
      label: "52-week low",
      value:
        financials.fiftyTwoWeekLow !== null
          ? currencyFmt.format(financials.fiftyTwoWeekLow)
          : "—",
    },
    {
      label: "Beta",
      value: financials.beta !== null ? financials.beta.toFixed(2) : "—",
    },
    {
      label: "Dividend yield",
      value:
        financials.dividendYield !== null
          ? (financials.dividendYield * 100).toFixed(2) + "%"
          : "—",
    },
    {
      label: "Avg volume",
      value:
        financials.avgVolume !== null
          ? compactNumberFmt.format(financials.avgVolume)
          : "—",
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Key statistics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {s.label}
            </div>
            <div className="mt-1 text-base font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const RECOMMENDATION_LABELS: Record<RecommendationKey, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  none: "—",
};

const RECOMMENDATION_STYLES: Record<RecommendationKey, string> = {
  strong_buy: "bg-emerald-600 text-white",
  buy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  hold: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  underperform: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
  sell: "bg-red-600 text-white",
  none: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

function AnalystRatings({
  financials,
  ticker,
  currentPrice,
}: {
  financials: TickerFinancials;
  ticker: string;
  currentPrice: number | null;
}) {
  const recoLabel = RECOMMENDATION_LABELS[financials.recommendationKey];
  const recoStyle = RECOMMENDATION_STYLES[financials.recommendationKey];
  const hasTargets =
    financials.targetLowPrice !== null &&
    financials.targetHighPrice !== null &&
    financials.targetMeanPrice !== null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Analyst ratings</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Recommendation
          </div>
          <div
            className={`mt-2 inline-flex rounded-md px-3 py-1.5 text-base font-semibold ${recoStyle}`}
          >
            {recoLabel}
          </div>
          {financials.recommendationMean !== null && (
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Mean {financials.recommendationMean.toFixed(2)}
              {financials.numberOfAnalystOpinions !== null && (
                <> · {financials.numberOfAnalystOpinions} analysts</>
              )}
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <TickerActions ticker={ticker} currentPrice={currentPrice} />
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Price target
          </div>
          {hasTargets ? (
            <PriceTargetBar
              low={financials.targetLowPrice!}
              mean={financials.targetMeanPrice!}
              high={financials.targetHighPrice!}
            />
          ) : (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              No analyst targets available.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PriceTargetBar({
  low,
  mean,
  high,
}: {
  low: number;
  mean: number;
  high: number;
}) {
  const range = high - low;
  const meanPct = range > 0 ? ((mean - low) / range) * 100 : 50;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono font-semibold">{currencyFmt.format(low)}</span>
        <span className="text-neutral-500 dark:text-neutral-400">
          mean{" "}
          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
            {currencyFmt.format(mean)}
          </span>
        </span>
        <span className="font-mono font-semibold">{currencyFmt.format(high)}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-400 dark:from-red-900 dark:via-amber-800 dark:to-emerald-700">
        <div
          aria-hidden
          className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900 dark:bg-white"
          style={{ left: `${Math.max(0, Math.min(100, meanPct))}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}
