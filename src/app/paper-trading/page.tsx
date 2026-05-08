"use client";

import { useEffect, useMemo, useState } from "react";
import PortfolioChart, {
  type PortfolioPoint,
} from "@/components/PortfolioChart";
import TickerLink from "@/components/TickerLink";
import {
  closePaperTrade,
  deletePaperTrade,
  effectivePrice,
  loadPaperTrades,
  tradePnL,
  updateTradeNote,
  type PaperTrade,
} from "@/lib/paperTrades";

type Quote = { price: number; currency: string; symbol: string };
type QuotesResponse = {
  quotes: Record<string, Quote | null>;
};

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat("en-US");

export default function PaperTradingPage() {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  function handleNoteSave(id: string, value: string) {
    setTrades(updateTradeNote(id, value));
    setEditingNoteId(null);
  }

  useEffect(() => {
    setTrades(loadPaperTrades());
  }, []);

  useEffect(() => {
    if (!trades || trades.length === 0) return;
    // Quotes are only needed for open positions — closed trades are marked at exitPrice.
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
    setQuotesLoading(true);
    setQuotesError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        const data = (await res.json()) as QuotesResponse;
        if (cancelled) return;
        setQuotes(data.quotes ?? {});
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
  }, [trades]);

  function handleDelete(id: string) {
    if (!confirm("Delete this paper trade?")) return;
    setTrades(deletePaperTrade(id));
  }

  async function handleClose(trade: PaperTrade) {
    if (!confirm(`Close ${trade.ticker} at the current market price?`)) return;
    setClosingId(trade.id);
    try {
      const res = await fetch(
        `/api/quotes?tickers=${encodeURIComponent(trade.ticker)}`,
      );
      const data = (await res.json()) as QuotesResponse;
      const quote = data.quotes?.[trade.ticker];
      if (!quote) {
        alert(
          `Could not fetch a current price for ${trade.ticker}. Try again in a moment.`,
        );
        return;
      }
      setTrades(closePaperTrade(trade.id, quote.price));
    } catch (e) {
      alert(
        `Failed to close position: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      setClosingId(null);
    }
  }

  const analytics = useMemo(() => computeAnalytics(trades, quotes), [trades, quotes]);
  const portfolioSeries = useMemo(
    () => buildPortfolioSeries(trades, quotes),
    [trades, quotes],
  );

  const openTrades = (trades ?? [])
    .filter((t) => !t.closedAt)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  const closedTrades = (trades ?? [])
    .filter((t) => !!t.closedAt)
    .sort((a, b) => ((a.closedAt ?? "") < (b.closedAt ?? "") ? 1 : -1));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Paper Trading</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Track simulated trades opened from political and insider signals. Live
          prices via Yahoo Finance.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Total invested"
          value={
            analytics.totalInvested === null
              ? "—"
              : currencyFmt.format(analytics.totalInvested)
          }
          hint={`${trades?.length ?? 0} trades total`}
        />
        <SummaryCard
          label="Current value"
          value={
            analytics.currentValue === null
              ? "—"
              : currencyFmt.format(analytics.currentValue)
          }
          hint={
            quotesLoading
              ? "Refreshing prices…"
              : `${analytics.openCount} open · ${analytics.closedCount} closed`
          }
        />
        <SummaryCard
          label="Total P&L"
          value={
            analytics.totalPnl === null
              ? "—"
              : `${currencyFmt.format(analytics.totalPnl)}${
                  analytics.totalPnlPct === null
                    ? ""
                    : ` (${analytics.totalPnlPct >= 0 ? "+" : ""}${analytics.totalPnlPct.toFixed(2)}%)`
                }`
          }
          tone={
            analytics.totalPnl === null
              ? "neutral"
              : analytics.totalPnl > 0
                ? "positive"
                : analytics.totalPnl < 0
                  ? "negative"
                  : "neutral"
          }
          hint="Realized + unrealized"
        />
        <SummaryCard
          label="Win rate"
          value={
            analytics.winRate === null
              ? "—"
              : `${analytics.winRate.toFixed(0)}%`
          }
          hint={
            analytics.evaluatedCount > 0
              ? `${analytics.winningCount} of ${analytics.evaluatedCount} positive`
              : "Not enough data"
          }
        />
        <SummaryCard
          label="Best position"
          value={
            analytics.bestPosition
              ? `${analytics.bestPosition.ticker} ${formatPct(
                  analytics.bestPosition.pnlPct,
                )}`
              : "—"
          }
          tone={analytics.bestPosition ? "positive" : "neutral"}
          hint={
            analytics.bestPosition
              ? currencyFmt.format(analytics.bestPosition.pnl)
              : "No winners yet"
          }
        />
        <SummaryCard
          label="Worst position"
          value={
            analytics.worstPosition
              ? `${analytics.worstPosition.ticker} ${formatPct(
                  analytics.worstPosition.pnlPct,
                )}`
              : "—"
          }
          tone={analytics.worstPosition ? "negative" : "neutral"}
          hint={
            analytics.worstPosition
              ? currencyFmt.format(analytics.worstPosition.pnl)
              : "No losses yet"
          }
        />
      </section>

      <PortfolioChart data={portfolioSeries} />

      {quotesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Live price fetch failed: {quotesError}
        </div>
      )}

      <PositionsTable
        title="Open positions"
        trades={openTrades}
        loading={trades === null}
        emptyMessage={
          trades !== null && openTrades.length === 0
            ? "No open positions. Open a paper trade from the Political Trades or SEC Insider Trades pages."
            : null
        }
        showClose
        closingId={closingId}
        quotes={quotes}
        quotesLoading={quotesLoading}
        onDelete={handleDelete}
        onClose={handleClose}
        editingNoteId={editingNoteId}
        onEditNote={setEditingNoteId}
        onNoteSave={handleNoteSave}
      />

      {closedTrades.length > 0 && (
        <PositionsTable
          title="Closed positions"
          trades={closedTrades}
          loading={false}
          emptyMessage={null}
          showClose={false}
          closingId={null}
          quotes={quotes}
          quotesLoading={false}
          onDelete={handleDelete}
          onClose={undefined}
          editingNoteId={editingNoteId}
          onEditNote={setEditingNoteId}
          onNoteSave={handleNoteSave}
        />
      )}
    </div>
  );
}

function PositionsTable({
  title,
  trades,
  loading,
  emptyMessage,
  showClose,
  closingId,
  quotes,
  quotesLoading,
  onDelete,
  onClose,
  editingNoteId,
  onEditNote,
  onNoteSave,
}: {
  title: string;
  trades: PaperTrade[];
  loading: boolean;
  emptyMessage: string | null;
  showClose: boolean;
  closingId: string | null;
  quotes: Record<string, Quote | null>;
  quotesLoading: boolean;
  onDelete: (id: string) => void;
  onClose: ((trade: PaperTrade) => void) | undefined;
  editingNoteId: string | null;
  onEditNote: (id: string | null) => void;
  onNoteSave: (id: string, value: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        {title} ({trades.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Entry</th>
              <th className="px-4 py-3 text-right font-medium">
                {showClose ? "Current" : "Exit"}
              </th>
              <th className="px-4 py-3 text-right font-medium">P&amp;L</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {emptyMessage && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {trades.map((t) => {
              const live = quotes[t.ticker];
              const livePrice = live?.price ?? null;
              const markPrice = effectivePrice(t, livePrice);
              const pnl = tradePnL(t, livePrice);
              const dateStr = t.closedAt ?? t.addedAt;
              return (
                <tr
                  key={t.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {new Date(dateStr).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <TickerLink ticker={t.ticker} />
                    {!t.closedAt &&
                      (t.stopLoss != null || t.takeProfit != null) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.stopLoss != null && (
                            <span className="inline-flex rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                              SL {currencyFmt.format(t.stopLoss)}
                            </span>
                          )}
                          {t.takeProfit != null && (
                            <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              TP {currencyFmt.format(t.takeProfit)}
                            </span>
                          )}
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    <DirectionBadge direction={t.direction} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {numberFmt.format(t.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {currencyFmt.format(t.entryPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {markPrice === null ? (
                      quotesLoading ? (
                        <span className="inline-block h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                      ) : (
                        "—"
                      )
                    ) : (
                      currencyFmt.format(markPrice)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs font-medium ${
                      pnl === null
                        ? "text-neutral-400"
                        : pnl > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : pnl < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-neutral-500"
                    }`}
                  >
                    {pnl === null ? "—" : currencyFmt.format(pnl)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <NoteCell
                      trade={t}
                      editing={editingNoteId === t.id}
                      onEdit={() => onEditNote(t.id)}
                      onCancel={() => onEditNote(null)}
                      onSave={(value) => onNoteSave(t.id, value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {showClose && onClose && (
                        <button
                          type="button"
                          onClick={() => onClose(t)}
                          disabled={closingId === t.id}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-md px-2 py-1 text-xs text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 lg:min-h-0"
                        >
                          {closingId === t.id ? "Closing…" : "Close"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(t.id)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 lg:min-h-0"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  hint?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className={`mt-2 truncate text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function NoteCell({
  trade,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  trade: PaperTrade;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(trade.note);

  useEffect(() => {
    if (editing) setDraft(trade.note);
  }, [editing, trade.note]);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() === trade.note.trim()) {
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
        rows={2}
        placeholder="Add a note…"
        className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
      />
    );
  }

  if (!trade.note) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 text-neutral-400 hover:text-emerald-700 dark:text-neutral-600 dark:hover:text-emerald-300"
        aria-label="Add note"
      >
        <span aria-hidden>✏️</span>
        <span>Add note</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      title="Click to edit"
      className="block w-full whitespace-pre-wrap text-left hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      {trade.note}
    </button>
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

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

type Analytics = {
  totalInvested: number | null;
  currentValue: number | null;
  totalPnl: number | null;
  totalPnlPct: number | null;
  openCount: number;
  closedCount: number;
  winRate: number | null;
  winningCount: number;
  evaluatedCount: number;
  bestPosition: { ticker: string; pnl: number; pnlPct: number } | null;
  worstPosition: { ticker: string; pnl: number; pnlPct: number } | null;
};

function computeAnalytics(
  trades: PaperTrade[] | null,
  quotes: Record<string, Quote | null>,
): Analytics {
  if (!trades || trades.length === 0) {
    return {
      totalInvested: trades === null ? null : 0,
      currentValue: trades === null ? null : 0,
      totalPnl: trades === null ? null : 0,
      totalPnlPct: null,
      openCount: 0,
      closedCount: 0,
      winRate: null,
      winningCount: 0,
      evaluatedCount: 0,
      bestPosition: null,
      worstPosition: null,
    };
  }

  let totalInvested = 0;
  let currentValue = 0;
  let totalPnl = 0;
  let openCount = 0;
  let closedCount = 0;
  let winningCount = 0;
  let evaluatedCount = 0;
  let best: { ticker: string; pnl: number; pnlPct: number } | null = null;
  let worst: { ticker: string; pnl: number; pnlPct: number } | null = null;
  let anyValuePriced = true;

  for (const t of trades) {
    if (t.closedAt) closedCount++;
    else openCount++;

    const invested = t.entryPrice * t.quantity;
    totalInvested += invested;

    const livePrice = quotes[t.ticker]?.price ?? null;
    const mark = effectivePrice(t, livePrice);
    if (mark === null) {
      anyValuePriced = false;
      continue;
    }

    currentValue += mark * t.quantity;
    const pnl = tradePnL(t, livePrice);
    if (pnl === null) continue;
    totalPnl += pnl;
    evaluatedCount++;
    if (pnl > 0) winningCount++;

    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    if (!best || pnlPct > best.pnlPct) best = { ticker: t.ticker, pnl, pnlPct };
    if (!worst || pnlPct < worst.pnlPct) worst = { ticker: t.ticker, pnl, pnlPct };
  }

  const totalPnlPct =
    totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;
  const winRate =
    evaluatedCount > 0 ? (winningCount / evaluatedCount) * 100 : null;

  return {
    totalInvested,
    currentValue: anyValuePriced ? currentValue : null,
    totalPnl: anyValuePriced ? totalPnl : null,
    totalPnlPct: anyValuePriced ? totalPnlPct : null,
    openCount,
    closedCount,
    winRate,
    winningCount,
    evaluatedCount,
    bestPosition: best && best.pnl > 0 ? best : null,
    worstPosition: worst && worst.pnl < 0 ? worst : null,
  };
}

function buildPortfolioSeries(
  trades: PaperTrade[] | null,
  quotes: Record<string, Quote | null>,
): PortfolioPoint[] {
  if (!trades || trades.length === 0) return [];

  // Each trade contributes its current mark-to-market value to the cumulative
  // chart, attributed to its entry date.
  const sorted = [...trades].sort((a, b) =>
    a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0,
  );

  const uniqueDates: string[] = [];
  const seen = new Set<string>();
  for (const t of sorted) {
    const day = t.addedAt.slice(0, 10);
    if (!seen.has(day)) {
      uniqueDates.push(day);
      seen.add(day);
    }
  }

  const points: PortfolioPoint[] = [];
  for (const date of uniqueDates) {
    const cutoff = `${date}T23:59:59.999Z`;
    let value = 0;
    for (const t of sorted) {
      if (t.addedAt > cutoff) continue;
      const livePrice = quotes[t.ticker]?.price ?? null;
      const mark = effectivePrice(t, livePrice);
      if (mark === null) continue;
      value += mark * t.quantity;
    }
    points.push({ date, value });
  }
  return points;
}
