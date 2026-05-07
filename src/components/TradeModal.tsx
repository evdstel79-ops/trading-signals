"use client";

import { useEffect, useState } from "react";
import {
  addPaperTrade,
  type PaperTrade,
  type PaperTradeDirection,
} from "@/lib/paperTrades";

type Props = {
  ticker: string;
  direction: PaperTradeDirection;
  source?: PaperTrade["source"];
  onClose: () => void;
  onSaved?: (trade: PaperTrade) => void;
};

type QuotesResponse = {
  quotes: Record<
    string,
    { price: number; currency: string; symbol: string } | null
  >;
};

export default function TradeModal({
  ticker: initialTicker,
  direction: initialDirection,
  source,
  onClose,
  onSaved,
}: Props) {
  const [ticker, setTicker] = useState(initialTicker);
  const [direction, setDirection] = useState<PaperTradeDirection>(
    initialDirection,
  );
  const [quantity, setQuantity] = useState("100");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTicker = ticker.trim().toUpperCase();
    const qty = Number(quantity);
    if (!cleanTicker) {
      setError("Ticker is required.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(cleanTicker)}`);
      const data = (await res.json()) as QuotesResponse;
      const quote = data.quotes?.[cleanTicker];
      if (!quote) {
        setError(
          `Could not fetch entry price for ${cleanTicker}. Check the ticker symbol.`,
        );
        setSubmitting(false);
        return;
      }
      const saved = addPaperTrade({
        ticker: cleanTicker,
        direction,
        quantity: qty,
        entryPrice: quote.price,
        note: note.trim(),
        source,
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save paper trade.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">New paper trade</h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Entry price will be fetched from Yahoo Finance at submit.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 lg:min-h-0 lg:min-w-0"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Ticker">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>

          <Field label="Direction">
            <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
              <DirButton
                active={direction === "buy"}
                color="emerald"
                onClick={() => setDirection("buy")}
              >
                Buy
              </DirButton>
              <DirButton
                active={direction === "sell"}
                color="red"
                onClick={() => setDirection("sell")}
              >
                Sell
              </DirButton>
            </div>
          </Field>

          <Field label="Quantity (shares)">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>

          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Following Pelosi disclosure"
              className="w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500"
            />
          </Field>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function DirButton({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: "emerald" | "red";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeStyles =
    color === "emerald"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  const inactive =
    "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm font-medium border-r border-neutral-200 last:border-r-0 dark:border-neutral-700 transition-colors ${
        active ? activeStyles : inactive
      }`}
    >
      {children}
    </button>
  );
}
