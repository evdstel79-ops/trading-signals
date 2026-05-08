"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { InsiderTrade } from "@/lib/insiderSignals";
import type { Party, PoliticalTrade } from "@/lib/politicalSignals";
import { getSectorsBatch } from "@/lib/sectorData";
import { useWatchlist } from "@/lib/watchlist";

type SearchKind = "ticker" | "politician" | "insider";

type SearchEntry = {
  kind: SearchKind;
  primary: string;
  /** Subtitle text. May be filled in lazily for tickers (sector). */
  secondary: string;
  href: string;
  /** Lowercased token used for matching. */
  searchKey: string;
};

type SearchIndex = {
  tickers: SearchEntry[];
  politicians: SearchEntry[];
  insiders: SearchEntry[];
};

const RESULT_LIMIT = 4;

const KIND_LABEL: Record<SearchKind, string> = {
  ticker: "Tickers",
  politician: "Politicians",
  insider: "Insiders",
};

const KIND_ICON: Record<SearchKind, string> = {
  ticker: "📈",
  politician: "🏛",
  insider: "👤",
};

export default function GlobalSearch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [sectorMap, setSectorMap] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const { items: watchlist, mounted: watchlistMounted } = useWatchlist();

  // Lazy index load on first focus.
  async function loadIndex() {
    if (index || loading) return;
    setLoading(true);
    try {
      const [polRes, insRes] = await Promise.all([
        fetch("/api/political-trades"),
        fetch("/api/insider-trades"),
      ]);
      const polJson = polRes.ok
        ? ((await polRes.json()) as { trades?: PoliticalTrade[] })
        : { trades: [] };
      const insJson = insRes.ok
        ? ((await insRes.json()) as { trades?: InsiderTrade[] })
        : { trades: [] };
      const political = polJson.trades ?? [];
      const insider = insJson.trades ?? [];

      const newIndex = buildIndex(political, insider, watchlist);
      setIndex(newIndex);

      // Fire-and-forget sector enrichment for tickers in the index.
      const tickerSymbols = newIndex.tickers.map((t) => t.primary);
      if (tickerSymbols.length > 0) {
        getSectorsBatch(tickerSymbols)
          .then((sectors) => setSectorMap(sectors))
          .catch(() => {
            // Sector enrichment is best-effort.
          });
      }
    } catch {
      // Soft-fail; the user can retry by typing again.
    } finally {
      setLoading(false);
    }
  }

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const node = containerRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!index) return null;
    const q = query.trim().toLowerCase();
    return {
      tickers: filterAndSort(index.tickers, q).slice(0, RESULT_LIMIT),
      politicians: filterAndSort(index.politicians, q).slice(0, RESULT_LIMIT),
      insiders: filterAndSort(index.insiders, q).slice(0, RESULT_LIMIT),
    };
  }, [index, query]);

  // Enrich ticker secondary text with sector when available.
  const ticketsWithSector = useMemo(() => {
    if (!filtered) return [];
    return filtered.tickers.map((t) => {
      const sector = sectorMap.get(t.primary);
      return { ...t, secondary: sector ?? t.secondary ?? "Ticker" };
    });
  }, [filtered, sectorMap]);

  const flatResults: SearchEntry[] = useMemo(() => {
    if (!filtered) return [];
    return [
      ...ticketsWithSector,
      ...filtered.politicians,
      ...filtered.insiders,
    ];
  }, [filtered, ticketsWithSector]);

  // Reset active index when results change.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, index, sectorMap]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (flatResults.length > 0) {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % flatResults.length);
      }
    } else if (e.key === "ArrowUp") {
      if (flatResults.length > 0) {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + flatResults.length) % flatResults.length);
      }
    } else if (e.key === "Enter") {
      const target = flatResults[activeIdx];
      if (target) {
        e.preventDefault();
        navigate(target.href);
      }
    }
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  const containerClass = compact
    ? "relative w-full max-w-xs"
    : "relative w-full";
  const inputClass = compact
    ? "w-full rounded-md border border-neutral-200 bg-white pl-7 pr-2 py-1.5 text-xs placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500"
    : "w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500";
  const iconClass = compact
    ? "absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
    : "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400";

  return (
    <div ref={containerRef} className={containerClass}>
      <div className="relative">
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            void loadIndex();
          }}
          onKeyDown={handleKeyDown}
          placeholder={compact ? "Search…" : "Search tickers, people…"}
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={open}
          className={inputClass}
        />
      </div>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 ${
            compact ? "top-full" : "top-full"
          }`}
        >
          <ResultsBody
            loading={loading}
            indexLoaded={Boolean(index)}
            watchlistMounted={watchlistMounted}
            filtered={filtered}
            tickers={ticketsWithSector}
            flatResults={flatResults}
            activeIdx={activeIdx}
            onSelect={navigate}
            onHover={setActiveIdx}
          />
        </div>
      )}
    </div>
  );
}

function ResultsBody({
  loading,
  indexLoaded,
  watchlistMounted,
  filtered,
  tickers,
  flatResults,
  activeIdx,
  onSelect,
  onHover,
}: {
  loading: boolean;
  indexLoaded: boolean;
  watchlistMounted: boolean;
  filtered: {
    tickers: SearchEntry[];
    politicians: SearchEntry[];
    insiders: SearchEntry[];
  } | null;
  tickers: SearchEntry[];
  flatResults: SearchEntry[];
  activeIdx: number;
  onSelect: (href: string) => void;
  onHover: (idx: number) => void;
}) {
  if (!watchlistMounted || (loading && !indexLoaded)) {
    return (
      <div className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Loading search…
      </div>
    );
  }

  if (!filtered) {
    return (
      <div className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        No data available.
      </div>
    );
  }

  const totalResults =
    tickers.length + filtered.politicians.length + filtered.insiders.length;
  if (totalResults === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
        No matches.
      </div>
    );
  }

  let runningIdx = 0;
  const tickerStart = runningIdx;
  runningIdx += tickers.length;
  const politicianStart = runningIdx;
  runningIdx += filtered.politicians.length;
  const insiderStart = runningIdx;

  return (
    <div className="max-h-[28rem] overflow-y-auto py-1">
      {tickers.length > 0 && (
        <Group
          kind="ticker"
          entries={tickers}
          startIdx={tickerStart}
          activeIdx={activeIdx}
          flatResults={flatResults}
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
      {filtered.politicians.length > 0 && (
        <Group
          kind="politician"
          entries={filtered.politicians}
          startIdx={politicianStart}
          activeIdx={activeIdx}
          flatResults={flatResults}
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
      {filtered.insiders.length > 0 && (
        <Group
          kind="insider"
          entries={filtered.insiders}
          startIdx={insiderStart}
          activeIdx={activeIdx}
          flatResults={flatResults}
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
    </div>
  );
}

function Group({
  kind,
  entries,
  startIdx,
  activeIdx,
  flatResults,
  onSelect,
  onHover,
}: {
  kind: SearchKind;
  entries: SearchEntry[];
  startIdx: number;
  activeIdx: number;
  flatResults: SearchEntry[];
  onSelect: (href: string) => void;
  onHover: (idx: number) => void;
}) {
  return (
    <div>
      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {KIND_LABEL[kind]}
      </div>
      <ul role="presentation">
        {entries.map((entry, i) => {
          const idx = startIdx + i;
          const active = activeIdx === idx && flatResults[idx]?.href === entry.href;
          return (
            <li key={`${entry.kind}-${entry.primary}`} role="option" aria-selected={active}>
              <button
                type="button"
                onPointerEnter={() => onHover(idx)}
                onClick={() => onSelect(entry.href)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span aria-hidden className="shrink-0 text-base">
                  {KIND_ICON[entry.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      entry.kind === "ticker"
                        ? "font-mono text-sm font-semibold"
                        : "truncate text-sm font-medium"
                    }
                  >
                    {entry.primary}
                  </div>
                  {entry.secondary && (
                    <div className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      {entry.secondary}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildIndex(
  political: PoliticalTrade[],
  insider: InsiderTrade[],
  watchlist: { ticker: string }[],
): SearchIndex {
  const tickerMap = new Map<string, SearchEntry>();
  for (const w of watchlist) {
    if (!w.ticker) continue;
    const t = w.ticker.toUpperCase();
    if (!tickerMap.has(t)) {
      tickerMap.set(t, {
        kind: "ticker",
        primary: t,
        secondary: "",
        href: `/ticker/${encodeURIComponent(t)}`,
        searchKey: t.toLowerCase(),
      });
    }
  }
  for (const p of political) {
    if (!p.ticker) continue;
    const t = p.ticker.toUpperCase();
    if (!tickerMap.has(t)) {
      tickerMap.set(t, {
        kind: "ticker",
        primary: t,
        secondary: "",
        href: `/ticker/${encodeURIComponent(t)}`,
        searchKey: t.toLowerCase(),
      });
    }
  }
  for (const i of insider) {
    if (!i.ticker) continue;
    const t = i.ticker.toUpperCase();
    if (!tickerMap.has(t)) {
      tickerMap.set(t, {
        kind: "ticker",
        primary: t,
        secondary: "",
        href: `/ticker/${encodeURIComponent(t)}`,
        searchKey: t.toLowerCase(),
      });
    }
  }

  const politicianMap = new Map<string, SearchEntry>();
  for (const p of political) {
    if (!p.memberName) continue;
    if (!politicianMap.has(p.memberName)) {
      politicianMap.set(p.memberName, {
        kind: "politician",
        primary: p.memberName,
        secondary: partyLabel(p.party),
        href: `/politicians/${encodeURIComponent(p.memberName)}`,
        searchKey: p.memberName.toLowerCase(),
      });
    }
  }

  const insiderMap = new Map<string, SearchEntry>();
  for (const i of insider) {
    if (!i.insiderName) continue;
    if (!insiderMap.has(i.insiderName)) {
      insiderMap.set(i.insiderName, {
        kind: "insider",
        primary: i.insiderName,
        secondary: i.insiderTitle ?? "",
        href: `/insiders/${encodeURIComponent(i.insiderName)}`,
        searchKey: i.insiderName.toLowerCase(),
      });
    }
  }

  return {
    tickers: [...tickerMap.values()],
    politicians: [...politicianMap.values()],
    insiders: [...insiderMap.values()],
  };
}

function filterAndSort(entries: SearchEntry[], q: string): SearchEntry[] {
  if (!q) return entries.slice(0, RESULT_LIMIT * 2);
  const matches: { entry: SearchEntry; rank: number }[] = [];
  for (const entry of entries) {
    const idx = entry.searchKey.indexOf(q);
    if (idx < 0) continue;
    // Rank: prefix matches first (rank 0), then by match position.
    matches.push({ entry, rank: idx === 0 ? 0 : 1 + idx });
  }
  matches.sort((a, b) => a.rank - b.rank);
  return matches.map((m) => m.entry);
}

function partyLabel(party: Party): string {
  if (party === "R") return "Republican";
  if (party === "D") return "Democrat";
  if (party === "I") return "Independent";
  return "—";
}
