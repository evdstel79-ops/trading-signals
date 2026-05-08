"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QuickAlertButton from "@/components/QuickAlertButton";
import { useWatchlist, type WatchlistItem } from "@/lib/watchlist";

type Quote = {
  price: number;
  currency: string;
  symbol: string;
  previousClose: number | null;
};
type QuotesResponse = { quotes: Record<string, Quote | null> };

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

// Module-scoped quotes cache. Survives client-side navigation away and back
// to /watchlist, so repeat visits within 30s skip the Yahoo round-trip.
const QUOTES_CACHE_TTL_MS = 30_000;
type QuotesCacheEntry = {
  key: string;
  data: Record<string, Quote | null>;
  at: number;
};
let quotesCache: QuotesCacheEntry | null = null;

export default function WatchlistPage() {
  const {
    items,
    loading: watchlistLoading,
    error: watchlistError,
    removeFromWatchlist,
  } = useWatchlist();

  const [quotes, setQuotes] = useState<Record<string, Quote | null>>(
    () => quotesCache?.data ?? {},
  );
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  useEffect(() => {
    if (watchlistLoading || items.length === 0) return;
    const tickers = Array.from(new Set(items.map((i) => i.ticker))).sort();
    const cacheKey = tickers.join(",");

    // Cache hit — useState's lazy init already seeded `quotes` from the
    // cache on this mount, so there's nothing else to do. Bail out before
    // touching state to avoid a cascading-render lint flag.
    if (
      quotesCache &&
      quotesCache.key === cacheKey &&
      Date.now() - quotesCache.at < QUOTES_CACHE_TTL_MS
    ) {
      return;
    }

    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes?lite=1&tickers=${encodeURIComponent(cacheKey)}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (cancelled) return;
        const next = data.quotes ?? {};
        setQuotes(next);
        quotesCache = { key: cacheKey, data: next, at: Date.now() };
      } catch (e) {
        if (cancelled) return;
        setQuotesError(
          e instanceof Error ? e.message : "Failed to fetch live prices",
        );
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watchlistLoading, items]);

  // Sort newest-first within the page
  const sorted = [...items].sort((a, b) =>
    a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Tickers you&apos;ve starred from political and insider trade signals.
          Live prices via Yahoo Finance.
        </p>
      </header>

      {watchlistError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load watchlist: {watchlistError}
        </div>
      )}
      {quotesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Live price fetch failed: {quotesError}
        </div>
      )}

      {watchlistLoading && items.length === 0 ? (
        <LoadingGrid />
      ) : !watchlistLoading && items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((item) => (
            <WatchCard
              key={item.ticker}
              item={item}
              quote={quotes[item.ticker] ?? null}
              loading={quotesLoading && !(item.ticker in quotes)}
              onRemove={() => removeFromWatchlist(item.ticker)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchCard({
  item,
  quote,
  loading,
  onRemove,
}: {
  item: WatchlistItem;
  quote: Quote | null;
  loading: boolean;
  onRemove: () => void;
}) {
  const change =
    quote && quote.previousClose && quote.previousClose > 0
      ? quote.price - quote.previousClose
      : null;
  const changePct =
    change !== null && quote?.previousClose
      ? (change / quote.previousClose) * 100
      : null;

  const tone =
    change === null ? "neutral" : change > 0 ? "up" : change < 0 ? "down" : "neutral";

  return (
    <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/ticker/${encodeURIComponent(item.ticker)}`}
          className="font-mono text-lg font-semibold tracking-tight hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
        >
          {item.ticker}
        </Link>
        <div className="flex items-center gap-1">
          <QuickAlertButton
            ticker={item.ticker}
            currentPrice={quote?.price ?? null}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.ticker} from watchlist`}
            title="Remove from watchlist"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 lg:min-h-0 lg:min-w-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex h-12 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Spinner />
            <span>Loading quote…</span>
          </div>
        ) : quote ? (
          <>
            <div className="text-2xl font-semibold">
              {currencyFmt.format(quote.price)}
            </div>
            <div
              className={`mt-1 text-sm font-medium ${
                tone === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tone === "down"
                    ? "text-red-600 dark:text-red-400"
                    : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {change !== null && changePct !== null ? (
                <>
                  {change >= 0 ? "+" : ""}
                  {currencyFmt.format(change)}{" "}
                  <span className="font-mono">
                    ({changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%)
                  </span>
                </>
              ) : (
                "—"
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold text-neutral-400 dark:text-neutral-600">
              —
            </div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Quote unavailable
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center text-neutral-300 dark:text-neutral-600">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold">Your watchlist is empty</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Click the star icon next to any row on the{" "}
        <span className="font-medium">Political Trades</span> or{" "}
        <span className="font-medium">SEC Insider Trades</span> page to add a
        ticker here.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-neutral-400 dark:text-neutral-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="h-5 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-4 h-7 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-2 h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}
