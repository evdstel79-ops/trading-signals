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

const PORTFOLIO_KEY = "trading-signals.portfolio-size.v1";
const RISK_PCT_KEY = "trading-signals.risk-pct.v1";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveNumber(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // localStorage may be unavailable (private browsing, etc.) — non-fatal.
  }
}

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
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portfolioSize, setPortfolioSize] = useState<number>(() =>
    loadNumber(PORTFOLIO_KEY, 10000),
  );
  const [riskPct, setRiskPct] = useState<number>(() =>
    loadNumber(RISK_PCT_KEY, 2),
  );
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceError, setLivePriceError] = useState<string | null>(null);

  useEffect(() => {
    saveNumber(PORTFOLIO_KEY, portfolioSize);
  }, [portfolioSize]);
  useEffect(() => {
    saveNumber(RISK_PCT_KEY, riskPct);
  }, [riskPct]);

  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/quotes?tickers=${encodeURIComponent(t)}`)
        .then(async (r) => {
          const data = (await r.json()) as QuotesResponse;
          if (cancelled) return;
          const quote = data.quotes?.[t];
          if (!quote) {
            setLivePrice(null);
            setLivePriceError(`No live quote for ${t}`);
            return;
          }
          setLivePrice(quote.price);
          setLivePriceError(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setLivePriceError(
            e instanceof Error ? e.message : "Quote fetch failed",
          );
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ticker]);

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

  const stopLossNum = Number(stopLoss);
  const targetNum = Number(takeProfit);
  const hasStopLoss = stopLoss.trim() !== "" && Number.isFinite(stopLossNum) && stopLossNum > 0;
  const hasTarget = takeProfit.trim() !== "" && Number.isFinite(targetNum) && targetNum > 0;

  const maxRisk = portfolioSize * (riskPct / 100);

  let riskPerShare: number | null = null;
  if (hasStopLoss && livePrice !== null) {
    const diff =
      direction === "buy" ? livePrice - stopLossNum : stopLossNum - livePrice;
    riskPerShare = diff > 0 ? diff : null;
  }

  const positionSize: number | null =
    riskPerShare !== null && maxRisk > 0
      ? Math.max(0, Math.floor(maxRisk / riskPerShare))
      : null;

  let rrRatio: number | null = null;
  if (hasStopLoss && hasTarget && livePrice !== null) {
    const profit =
      direction === "buy" ? targetNum - livePrice : livePrice - targetNum;
    const risk =
      direction === "buy" ? livePrice - stopLossNum : stopLossNum - livePrice;
    if (risk > 0 && profit > 0) {
      rrRatio = profit / risk;
    }
  }

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

    let stopLossValue: number | null = null;
    if (stopLoss.trim()) {
      const parsed = Number(stopLoss);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Stop loss must be a positive number.");
        return;
      }
      stopLossValue = parsed;
    }

    let takeProfitValue: number | null = null;
    if (takeProfit.trim()) {
      const parsed = Number(takeProfit);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Take profit must be a positive number.");
        return;
      }
      takeProfitValue = parsed;
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
        stopLoss: stopLossValue,
        takeProfit: takeProfitValue,
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

          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
                Position sizing
              </h3>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {livePrice !== null
                  ? `Entry ~ ${formatPrice(livePrice)}`
                  : livePriceError
                    ? "no live price"
                    : "fetching price…"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Portfolio size ($)">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={portfolioSize}
                  onChange={(e) => setPortfolioSize(Number(e.target.value) || 0)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </Field>
              <Field label={`Risk per trade · ${riskPct.toFixed(1)}%`}>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={riskPct}
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                  className="h-9 w-full accent-emerald-600"
                  aria-label="Risk per trade percent"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Stop loss ($)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="e.g. 45.00"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </Field>
              <Field label="Target ($) (optional)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="e.g. 55.00"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </Field>
            </div>

            <SizingCalc
              maxRisk={maxRisk}
              positionSize={positionSize}
              hasStopLoss={hasStopLoss}
              hasLivePrice={livePrice !== null}
              rrRatio={rrRatio}
              hasTarget={hasTarget}
              onApplySize={(n) => setQuantity(String(n))}
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Position auto-closes if price hits stop loss or target.
            </p>
          </div>

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

function formatPrice(p: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(p);
}

function SizingCalc({
  maxRisk,
  positionSize,
  hasStopLoss,
  hasLivePrice,
  rrRatio,
  hasTarget,
  onApplySize,
}: {
  maxRisk: number;
  positionSize: number | null;
  hasStopLoss: boolean;
  hasLivePrice: boolean;
  rrRatio: number | null;
  hasTarget: boolean;
  onApplySize: (n: number) => void;
}) {
  const rrColor =
    rrRatio === null
      ? "neutral"
      : rrRatio >= 2.0
        ? "emerald"
        : rrRatio >= 1.0
          ? "amber"
          : "red";
  const rrStyles: Record<"emerald" | "amber" | "red" | "neutral", string> = {
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
    red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
    neutral:
      "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };

  return (
    <div className="space-y-1.5 rounded-md bg-white p-2.5 text-xs dark:bg-neutral-900">
      <Row label="Max risk">
        <span className="font-mono font-semibold tabular-nums">
          {currencyFmt.format(maxRisk)}{" "}
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            at risk
          </span>
        </span>
      </Row>
      <Row label="Position size">
        {positionSize !== null ? (
          <span className="flex items-center gap-2">
            <span className="font-mono font-semibold tabular-nums">
              {positionSize.toLocaleString("en-US")} shares
            </span>
            <button
              type="button"
              onClick={() => onApplySize(positionSize)}
              className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
            >
              Use
            </button>
          </span>
        ) : (
          <span className="text-neutral-500 dark:text-neutral-400">
            {!hasLivePrice
              ? "Waiting for entry price"
              : !hasStopLoss
                ? "Enter stop loss"
                : "Stop loss must be on the risk side of entry"}
          </span>
        )}
      </Row>
      <Row label="R:R">
        {rrRatio !== null ? (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 font-mono font-semibold tabular-nums ${rrStyles[rrColor]}`}
          >
            {rrRatio.toFixed(2)}
          </span>
        ) : (
          <span className="text-neutral-500 dark:text-neutral-400">
            {hasTarget && hasStopLoss && hasLivePrice
              ? "Target on wrong side"
              : "Set a target to calculate R:R"}
          </span>
        )}
      </Row>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span>{children}</span>
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
