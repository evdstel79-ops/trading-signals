"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { NewsItem } from "@/lib/tickerNews";
import { useWatchlist } from "@/lib/watchlist";

type FeedItem = NewsItem & { ticker: string };

const REFRESH_MS = 5 * 60 * 1000;
const MAX_ARTICLES = 50;
const CONCURRENCY = 5;

const TICKER_PALETTE = [
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
];

export default function NewsPage() {
  const { items: watchlist, mounted } = useWatchlist();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const tickers = useMemo(
    () => Array.from(new Set(watchlist.map((w) => w.ticker).filter(Boolean))),
    [watchlist],
  );
  const tickerKey = useMemo(() => [...tickers].sort().join(","), [tickers]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (tickers.length === 0) {
        setFeed([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const all: FeedItem[] = [];
        for (let i = 0; i < tickers.length; i += CONCURRENCY) {
          if (signal.aborted) return;
          const chunk = tickers.slice(i, i + CONCURRENCY);
          const settled = await Promise.allSettled(
            chunk.map(async (ticker) => {
              const res = await fetch(
                `/api/ticker-news?ticker=${encodeURIComponent(ticker)}`,
                { signal },
              );
              if (!res.ok) throw new Error(`Failed: ${res.status}`);
              const data = (await res.json()) as { news?: NewsItem[] };
              return (data.news ?? []).map((n) => ({ ...n, ticker }));
            }),
          );
          for (const r of settled) {
            if (r.status === "fulfilled") all.push(...r.value);
          }
        }
        if (signal.aborted) return;

        const seen = new Set<string>();
        const deduped: FeedItem[] = [];
        for (const item of all) {
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          deduped.push(item);
        }
        deduped.sort((a, b) =>
          a.publishedAt < b.publishedAt
            ? 1
            : a.publishedAt > b.publishedAt
              ? -1
              : 0,
        );
        setFeed(deduped.slice(0, MAX_ARTICLES));
      } catch (e) {
        if (signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load news");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [tickers],
  );

  useEffect(() => {
    if (!mounted) return;
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => {
      load(controller.signal);
    }, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // tickerKey is the stable identity for the watchlist set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tickerKey]);

  const filtered = useMemo(
    () =>
      activeTicker === null
        ? feed
        : feed.filter((item) => item.ticker === activeTicker),
    [feed, activeTicker],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Latest headlines for every ticker on your watchlist. Auto-refreshes
          every 5 minutes.
        </p>
      </header>

      {!mounted ? (
        <SkeletonState />
      ) : tickers.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <FilterBar
            tickers={tickers}
            active={activeTicker}
            onChange={setActiveTicker}
          />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && feed.length === 0 ? (
            <SkeletonState />
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              {activeTicker
                ? `No recent news for ${activeTicker}.`
                : "No news in the last polling window."}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <NewsCard key={item.url} item={item} />
              ))}
            </ul>
          )}

          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {feed.length} article{feed.length === 1 ? "" : "s"} from{" "}
            {tickers.length} watchlist ticker
            {tickers.length === 1 ? "" : "s"}
            {loading && feed.length > 0 ? " · refreshing…" : ""}
          </div>
        </>
      )}
    </div>
  );
}

function FilterBar({
  tickers,
  active,
  onChange,
}: {
  tickers: string[];
  active: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterButton
        label="All"
        selected={active === null}
        onClick={() => onChange(null)}
      />
      {tickers.map((t) => (
        <FilterButton
          key={t}
          label={t}
          selected={active === t}
          color={tickerColor(t)}
          onClick={() => onChange(active === t ? null : t)}
        />
      ))}
    </div>
  );
}

function FilterButton({
  label,
  selected,
  color,
  onClick,
}: {
  label: string;
  selected: boolean;
  color?: string;
  onClick: () => void;
}) {
  const base =
    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors";
  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${
          color ??
          "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
        } ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-neutral-800`}
    >
      {label}
    </button>
  );
}

function NewsCard({ item }: { item: FeedItem }) {
  return (
    <li className="group flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-emerald-500 hover:bg-emerald-50/30 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20">
      {item.thumbnail && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.title}
          className="shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnail}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className="h-16 w-16 rounded-md object-cover"
          />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Link
            href={`/ticker/${encodeURIComponent(item.ticker)}`}
            className={`inline-flex rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${tickerColor(
              item.ticker,
            )}`}
          >
            {item.ticker}
          </Link>
          <span className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
            {item.publisher || "Yahoo Finance"}
            {item.publishedAt && <> · {formatRelative(item.publishedAt)}</>}
          </span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-300"
        >
          {item.title}
        </a>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center text-neutral-300 dark:text-neutral-600">
        <span className="text-3xl" aria-hidden>
          📰
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold">Your watchlist is empty</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Add tickers to your watchlist to see their news here.{" "}
        <Link
          href="/watchlist"
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
        >
          Open watchlist →
        </Link>
      </p>
    </div>
  );
}

function SkeletonState() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  }
  return TICKER_PALETTE[hash % TICKER_PALETTE.length];
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
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
