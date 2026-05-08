"use client";

import { useEffect, useMemo, useState } from "react";

import TickerLink from "@/components/TickerLink";
import {
  effectivePrice,
  loadPaperTrades,
  tradePnL,
  updateTradeNote,
  updateTradeTags,
  type PaperTrade,
} from "@/lib/paperTrades";

type Quote = { price: number; currency: string; symbol: string };
type QuotesResponse = { quotes: Record<string, Quote | null> };

const SUGGESTED_TAGS = [
  "political signal",
  "insider signal",
  "high conviction",
  "speculative",
  "stop-loss hit",
  "take-profit hit",
];

const TAG_PALETTE = [
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
];

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat("en-US");

export default function JournalPage() {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPaperTrades()
      .then((next) => {
        if (!cancelled) setTrades(next);
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trades || trades.length === 0) return;
    const tickers = Array.from(
      new Set(
        trades
          .filter((t) => !t.closedAt)
          .map((t) => t.ticker)
          .filter(Boolean),
      ),
    );
    if (tickers.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (cancelled) return;
        setQuotes(data.quotes ?? {});
      } catch {
        // Soft-fail; closed trades still display from exitPrice.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trades]);

  const groups = useMemo(() => groupByDay(trades ?? []), [trades]);

  async function handleNoteSave(id: string, value: string) {
    try {
      const updated = await updateTradeNote(id, value);
      setTrades((prev) =>
        prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev,
      );
      setEditingNoteId(null);
    } catch {
      // Leave the note input open; the user can retry.
    }
  }

  async function handleTagsSave(id: string, tags: string[]) {
    try {
      const updated = await updateTradeTags(id, tags);
      setTrades((prev) =>
        prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev,
      );
    } catch {
      // Soft-fail; user can retry.
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Trade journal</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every paper trade you&apos;ve opened, with notes and tags for
          reflection. Stored locally in this browser.
        </p>
      </header>

      {trades === null && (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Loading…
        </div>
      )}

      {trades !== null && trades.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          No trades yet. Open a paper trade from the Political Trades or SEC
          Insider Trades pages — entries will appear here in chronological order.
        </div>
      )}

      {groups.map((group) => (
        <section key={group.day}>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {formatDateHeader(group.day)}
          </h2>
          <div className="space-y-3">
            {group.trades.map((t) => (
              <JournalEntry
                key={t.id}
                trade={t}
                quote={quotes[t.ticker] ?? null}
                editingNote={editingNoteId === t.id}
                onEditNote={() => setEditingNoteId(t.id)}
                onCancelNote={() => setEditingNoteId(null)}
                onSaveNote={(value) => handleNoteSave(t.id, value)}
                onSaveTags={(tags) => handleTagsSave(t.id, tags)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function JournalEntry({
  trade,
  quote,
  editingNote,
  onEditNote,
  onCancelNote,
  onSaveNote,
  onSaveTags,
}: {
  trade: PaperTrade;
  quote: Quote | null;
  editingNote: boolean;
  onEditNote: () => void;
  onCancelNote: () => void;
  onSaveNote: (value: string) => void;
  onSaveTags: (tags: string[]) => void;
}) {
  const livePrice = quote?.price ?? null;
  const mark = effectivePrice(trade, livePrice);
  const pnl = tradePnL(trade, livePrice);
  const pnlTone =
    pnl === null
      ? "text-neutral-500 dark:text-neutral-400"
      : pnl > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : pnl < 0
          ? "text-red-600 dark:text-red-400"
          : "text-neutral-500 dark:text-neutral-400";

  const tags = trade.tags ?? [];

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-base font-semibold">
          <TickerLink ticker={trade.ticker} />
        </span>
        <DirectionBadge direction={trade.direction} />
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {numberFmt.format(trade.quantity)} sh @{" "}
          {currencyFmt.format(trade.entryPrice)}
        </span>
        {mark !== null && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            → {currencyFmt.format(mark)}
          </span>
        )}
        <span className={`ml-auto text-sm font-semibold ${pnlTone}`}>
          {pnl === null ? "—" : currencyFmt.format(pnl)}
        </span>
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {trade.closedAt
          ? `Closed ${formatDay(trade.closedAt)}`
          : `Opened ${formatDay(trade.addedAt)}`}
        {trade.source && trade.source !== "manual" && (
          <span className="ml-2">· {trade.source} signal</span>
        )}
      </div>

      <div className="mt-3">
        <NoteEditor
          note={trade.note}
          editing={editingNote}
          onEdit={onEditNote}
          onCancel={onCancelNote}
          onSave={onSaveNote}
        />
      </div>

      <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <TagsEditor tags={tags} onChange={onSaveTags} />
      </div>
    </article>
  );
}

function NoteEditor({
  note,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  note: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    if (editing) setDraft(note);
  }, [editing, note]);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() === note.trim()) {
            onCancel();
          } else {
            onSave(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={3}
        placeholder="What's the thesis? What signal did this come from? What's the risk?"
        className="w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
      />
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-emerald-700 dark:text-neutral-500 dark:hover:text-emerald-300"
      >
        <span aria-hidden>✏️</span>
        <span>Add note</span>
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
        {note}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs text-neutral-400 hover:text-emerald-700 dark:text-neutral-500 dark:hover:text-emerald-300"
      >
        Edit
      </button>
    </div>
  );
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const tag = value.trim();
    if (!tag) return;
    if (tags.includes(tag)) return;
    onChange([...tags, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  const remainingSuggestions = SUGGESTED_TAGS.filter((s) => !tags.includes(s));

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              title="Click to remove"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80 ${tagColor(tag)}`}
            >
              {tag}
              <span aria-hidden className="text-[10px] opacity-60">
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft);
            }
            if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              e.preventDefault();
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder="Add tag and press Enter…"
          className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500"
        />
      </div>

      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-md border border-dashed border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:border-emerald-500 hover:text-emerald-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: PaperTrade["direction"] }) {
  const styles =
    direction === "buy"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {direction}
    </span>
  );
}

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function groupByDay(
  trades: PaperTrade[],
): { day: string; trades: PaperTrade[] }[] {
  const sorted = [...trades].sort((a, b) =>
    a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0,
  );
  const map = new Map<string, PaperTrade[]>();
  for (const trade of sorted) {
    const day = trade.addedAt.slice(0, 10);
    let arr = map.get(day);
    if (!arr) {
      arr = [];
      map.set(day, arr);
    }
    arr.push(trade);
  }
  return Array.from(map.entries()).map(([day, trades]) => ({ day, trades }));
}

function formatDateHeader(day: string): string {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
