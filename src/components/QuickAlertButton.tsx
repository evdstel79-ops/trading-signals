"use client";

import { useEffect, useRef, useState } from "react";

import {
  addAlert,
  useAlerts,
  type AlertCondition,
} from "@/lib/priceAlerts";

const EMAIL_STORAGE_KEY = "trading-signals.alert-email.v1";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function QuickAlertButton({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice?: number | null;
}) {
  const { alerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hasActiveAlert = alerts.some(
    (a) => a.ticker === ticker.toUpperCase() && !a.triggeredAt,
  );

  function openPopover() {
    setError(null);
    setSuccess(false);
    setCondition(
      currentPrice && currentPrice > 0 ? "above" : "above",
    );
    setTargetPrice(
      typeof currentPrice === "number" && currentPrice > 0
        ? currentPrice.toFixed(2)
        : "",
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const node = containerRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = parseFloat(targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Target price must be a positive number.");
      return;
    }

    let email: string | undefined;
    try {
      email = window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? undefined;
    } catch {
      // localStorage unavailable; create alert without email.
    }

    addAlert({
      ticker,
      condition,
      targetPrice: price,
      email: email?.trim() || undefined,
    });

    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
    }, 900);
  }

  if (!ticker) return null;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label={
          hasActiveAlert
            ? `Alert active for ${ticker}; click to add another`
            : `Set price alert for ${ticker}`
        }
        title={
          hasActiveAlert ? "Alert active — add another" : "Set price alert"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 transition-colors lg:min-h-0 lg:min-w-0 ${
          hasActiveAlert
            ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            : "text-neutral-300 hover:bg-neutral-100 hover:text-emerald-600 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-emerald-400"
        }`}
      >
        <BellIcon filled={hasActiveAlert} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Set price alert for ${ticker}`}
          className="absolute right-0 top-full z-40 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Alert · <span className="font-mono text-neutral-900 dark:text-neutral-100">{ticker}</span>
            </h3>
            {typeof currentPrice === "number" && currentPrice > 0 && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                now {currencyFmt.format(currentPrice)}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
              <CondButton
                active={condition === "above"}
                color="emerald"
                onClick={() => setCondition("above")}
              >
                Above
              </CondButton>
              <CondButton
                active={condition === "below"}
                color="red"
                onClick={() => setCondition("below")}
              >
                Below
              </CondButton>
            </div>

            <label className="block">
              <span className="sr-only">Target price</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Target price"
                required
                autoFocus
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={success}
              className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
                success
                  ? "bg-emerald-500"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {success ? (
                <>
                  <CheckIcon /> Added
                </>
              ) : (
                "Add alert"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function CondButton({
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
      className={`flex-1 px-3 py-1.5 text-xs font-medium border-r border-neutral-200 last:border-r-0 dark:border-neutral-700 transition-colors ${
        active ? activeStyles : inactive
      }`}
    >
      {children}
    </button>
  );
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
