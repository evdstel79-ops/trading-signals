"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import ComparisonChart from "@/components/ComparisonChart";
import type { InsiderTrade } from "@/lib/insiderSignals";
import type { PoliticalTrade } from "@/lib/politicalSignals";
import type { Quote } from "@/lib/quotes";
import type { HistoryPoint } from "@/lib/tickerHistory";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("en-US");

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      quotes: { a: Quote | null; b: Quote | null };
      history: { a: HistoryPoint[]; b: HistoryPoint[] };
      political: { a: PoliticalTrade[]; b: PoliticalTrade[] };
      insider: { a: InsiderTrade[]; b: InsiderTrade[] };
    }
  | { status: "error"; message: string };

export default function ComparePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CompareView />
    </Suspense>
  );
}

function CompareView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickerA = searchParams.get("a")?.trim().toUpperCase() ?? "";
  const tickerB = searchParams.get("b")?.trim().toUpperCase() ?? "";

  const hasBoth = Boolean(tickerA && tickerB);

  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!hasBoth) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const [quotesRes, histAres, histBres, polRes, insRes] =
          await Promise.all([
            fetch(
              `/api/quotes?tickers=${encodeURIComponent(`${tickerA},${tickerB}`)}`,
              { cache: "no-store" },
            ),
            fetch(
              `/api/ticker-history?ticker=${encodeURIComponent(tickerA)}&range=1y`,
            ),
            fetch(
              `/api/ticker-history?ticker=${encodeURIComponent(tickerB)}&range=1y`,
            ),
            fetch("/api/political-trades"),
            fetch("/api/insider-trades"),
          ]);
        const quotesJson = (await quotesRes.json()) as {
          quotes?: Record<string, Quote | null>;
        };
        const histAjson = (await histAres.json()) as {
          history?: HistoryPoint[];
        };
        const histBjson = (await histBres.json()) as {
          history?: HistoryPoint[];
        };
        const polJson = (await polRes.json()) as { trades?: PoliticalTrade[] };
        const insJson = (await insRes.json()) as { trades?: InsiderTrade[] };
        if (cancelled) return;

        const allPolitical = polJson.trades ?? [];
        const allInsider = insJson.trades ?? [];

        setState({
          status: "ready",
          quotes: {
            a: quotesJson.quotes?.[tickerA] ?? null,
            b: quotesJson.quotes?.[tickerB] ?? null,
          },
          history: {
            a: histAjson.history ?? [],
            b: histBjson.history ?? [],
          },
          political: {
            a: allPolitical.filter((t) => t.ticker.toUpperCase() === tickerA),
            b: allPolitical.filter((t) => t.ticker.toUpperCase() === tickerB),
          },
          insider: {
            a: allInsider.filter((t) => t.ticker.toUpperCase() === tickerA),
            b: allInsider.filter((t) => t.ticker.toUpperCase() === tickerB),
          },
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load data",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickerA, tickerB, hasBoth]);

  function handleSubmit(a: string, b: string) {
    const cleanA = a.trim().toUpperCase();
    const cleanB = b.trim().toUpperCase();
    if (!cleanA || !cleanB) return;
    router.push(
      `/compare?a=${encodeURIComponent(cleanA)}&b=${encodeURIComponent(cleanB)}`,
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Side-by-side performance, signal flow, and recent trades for two
          tickers.
        </p>
      </header>

      <CompareForm
        initialA={tickerA}
        initialB={tickerB}
        onSubmit={handleSubmit}
      />

      {!hasBoth && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Enter two tickers above to compare them.
        </div>
      )}

      {hasBoth && state.status === "loading" && (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Loading {tickerA} vs {tickerB}…
        </div>
      )}

      {hasBoth && state.status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </div>
      )}

      {hasBoth && state.status === "ready" && (
        <>
          <StatsGrid
            tickerA={tickerA}
            tickerB={tickerB}
            quotes={state.quotes}
            history={state.history}
            political={state.political}
            insider={state.insider}
          />

          <ComparisonChart
            tickerA={tickerA}
            tickerB={tickerB}
            historyA={state.history.a}
            historyB={state.history.b}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentTradesColumn
              ticker={tickerA}
              political={state.political.a}
              insider={state.insider.a}
            />
            <RecentTradesColumn
              ticker={tickerB}
              political={state.political.b}
              insider={state.insider.b}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CompareForm({
  initialA,
  initialB,
  onSubmit,
}: {
  initialA: string;
  initialB: string;
  onSubmit: (a: string, b: string) => void;
}) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);

  useEffect(() => {
    setA(initialA);
  }, [initialA]);
  useEffect(() => {
    setB(initialB);
  }, [initialB]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(a, b);
      }}
      className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-32">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Ticker A
          </div>
          <input
            type="text"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="AAPL"
            required
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <label className="block w-32">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Ticker B
          </div>
          <input
            type="text"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="NVDA"
            required
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Compare
        </button>
      </div>
    </form>
  );
}

type StatRow = {
  label: string;
  /** "a" if A is "better", "b" if B is "better", null if no winner. */
  winner: "a" | "b" | null;
  valueA: string;
  valueB: string;
};

function StatsGrid({
  tickerA,
  tickerB,
  quotes,
  history,
  political,
  insider,
}: {
  tickerA: string;
  tickerB: string;
  quotes: { a: Quote | null; b: Quote | null };
  history: { a: HistoryPoint[]; b: HistoryPoint[] };
  political: { a: PoliticalTrade[]; b: PoliticalTrade[] };
  insider: { a: InsiderTrade[]; b: InsiderTrade[] };
}) {
  const rows = useMemo<StatRow[]>(() => {
    const dayChangeA = computeDayChange(quotes.a);
    const dayChangeB = computeDayChange(quotes.b);
    const rangeA = computeYearRange(history.a);
    const rangeB = computeYearRange(history.b);

    const polA = political.a.length;
    const polB = political.b.length;
    const insA = insider.a.length;
    const insB = insider.b.length;

    return [
      {
        label: "Current price",
        valueA: quotes.a ? currencyFmt.format(quotes.a.price) : "—",
        valueB: quotes.b ? currencyFmt.format(quotes.b.price) : "—",
        winner: null,
      },
      {
        label: "Day change",
        valueA: formatPct(dayChangeA),
        valueB: formatPct(dayChangeB),
        winner: pickHigher(dayChangeA, dayChangeB),
      },
      {
        label: "52-week high",
        valueA: rangeA.high !== null ? currencyFmt.format(rangeA.high) : "—",
        valueB: rangeB.high !== null ? currencyFmt.format(rangeB.high) : "—",
        winner: pickHigher(rangeA.high, rangeB.high),
      },
      {
        label: "52-week low",
        valueA: rangeA.low !== null ? currencyFmt.format(rangeA.low) : "—",
        valueB: rangeB.low !== null ? currencyFmt.format(rangeB.low) : "—",
        winner: null,
      },
      {
        label: "Sector",
        valueA: quotes.a?.sector ?? "—",
        valueB: quotes.b?.sector ?? "—",
        winner: null,
      },
      {
        label: "Political trades",
        valueA: numberFmt.format(polA),
        valueB: numberFmt.format(polB),
        winner: pickHigher(polA, polB),
      },
      {
        label: "Insider trades",
        valueA: numberFmt.format(insA),
        valueB: numberFmt.format(insB),
        winner: pickHigher(insA, insB),
      },
    ];
  }, [quotes, history, political, insider]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <StatsCard
        ticker={tickerA}
        accent="emerald"
        rows={rows.map((r) => ({
          label: r.label,
          value: r.valueA,
          highlight: r.winner === "a",
        }))}
        quote={quotes.a}
      />
      <StatsCard
        ticker={tickerB}
        accent="orange"
        rows={rows.map((r) => ({
          label: r.label,
          value: r.valueB,
          highlight: r.winner === "b",
        }))}
        quote={quotes.b}
      />
    </div>
  );
}

function StatsCard({
  ticker,
  accent,
  rows,
  quote,
}: {
  ticker: string;
  accent: "emerald" | "orange";
  rows: { label: string; value: string; highlight: boolean }[];
  quote: Quote | null;
}) {
  const dotClass =
    accent === "emerald" ? "bg-emerald-500" : "bg-orange-500";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-baseline gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <Link
          href={`/ticker/${encodeURIComponent(ticker)}`}
          className="font-mono text-lg font-semibold tracking-tight hover:underline"
        >
          {ticker}
        </Link>
        {quote?.longname && (
          <span className="truncate text-sm text-neutral-600 dark:text-neutral-400">
            {quote.longname}
          </span>
        )}
      </div>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <dt className="text-neutral-500 dark:text-neutral-400">{r.label}</dt>
            <dd
              className={`text-right font-medium ${
                r.highlight
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-900 dark:text-neutral-100"
              }`}
              title={r.highlight ? "Better of the two" : undefined}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RecentTradesColumn({
  ticker,
  political,
  insider,
}: {
  ticker: string;
  political: PoliticalTrade[];
  insider: InsiderTrade[];
}) {
  const recentPolitical = [...political]
    .sort((a, b) => (a.filedAt < b.filedAt ? 1 : -1))
    .slice(0, 5);
  const recentInsider = [...insider]
    .sort((a, b) => (a.filedAt < b.filedAt ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="font-mono text-sm font-semibold">{ticker}</h2>
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        <TradeBlock
          title={`Political trades (${political.length})`}
          empty="No political trades."
        >
          {recentPolitical.map((t, i) => (
            <li
              key={`p-${i}`}
              className="flex items-baseline justify-between gap-2 py-1.5 text-xs"
            >
              <span className="truncate">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {t.filedAt}
                </span>{" "}
                <span className="font-medium">{t.memberName}</span>
              </span>
              <SideBadge side={t.transactionType} />
            </li>
          ))}
        </TradeBlock>
        <TradeBlock
          title={`Insider trades (${insider.length})`}
          empty="No insider trades."
        >
          {recentInsider.map((t, i) => (
            <li
              key={`i-${i}`}
              className="flex items-baseline justify-between gap-2 py-1.5 text-xs"
            >
              <span className="truncate">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {t.filedAt}
                </span>{" "}
                <span className="font-medium">{t.insiderName}</span>
              </span>
              <SideBadge side={t.transactionType} />
            </li>
          ))}
        </TradeBlock>
      </div>
    </div>
  );
}

function TradeBlock({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const isEmpty = childArray.filter(Boolean).length === 0;
  return (
    <div className="px-4 py-3">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {isEmpty ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{empty}</p>
      ) : (
        <ul>{children}</ul>
      )}
    </div>
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
      className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles}`}
    >
      {side}
    </span>
  );
}

function LoadingScreen() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      Loading…
    </div>
  );
}

function computeDayChange(quote: Quote | null): number | null {
  if (!quote || !quote.previousClose || quote.previousClose <= 0) return null;
  return ((quote.price - quote.previousClose) / quote.previousClose) * 100;
}

function computeYearRange(history: HistoryPoint[]): {
  high: number | null;
  low: number | null;
} {
  if (history.length === 0) return { high: null, low: null };
  let high = -Infinity;
  let low = Infinity;
  for (const p of history) {
    if (p.close > high) high = p.close;
    if (p.close < low) low = p.close;
  }
  return {
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
  };
}

function pickHigher(
  a: number | null,
  b: number | null,
): "a" | "b" | null {
  if (a === null && b === null) return null;
  if (a === null) return "b";
  if (b === null) return "a";
  if (a === b) return null;
  return a > b ? "a" : "b";
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
