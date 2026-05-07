"use client";

import { useState } from "react";
import {
  useAlerts,
  type AlertCondition,
  type PriceAlert,
} from "@/lib/priceAlerts";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function AlertsPage() {
  const { alerts, add, remove, mounted } = useAlerts();
  const [ticker, setTicker] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTicker = ticker.trim().toUpperCase();
    const price = parseFloat(targetPrice);
    if (!cleanTicker) {
      setError("Ticker is required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Target price must be a positive number.");
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          const result = await Notification.requestPermission();
          setPermission(result);
        } catch {
          // Ignored; alert still gets created.
        }
      } else {
        setPermission(Notification.permission);
      }
    }

    add({ ticker: cleanTicker, condition, targetPrice: price });
    setTicker("");
    setTargetPrice("");
    setCondition("above");
  }

  const sorted = [...alerts].sort((a, b) => {
    // Active alerts first, then most recently triggered, then most recently created.
    const aActive = !a.triggeredAt;
    const bActive = !b.triggeredAt;
    if (aActive !== bActive) return aActive ? -1 : 1;
    const aT = a.triggeredAt ?? a.createdAt;
    const bT = b.triggeredAt ?? b.createdAt;
    return aT < bT ? 1 : aT > bT ? -1 : 0;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Price Alerts</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Get a browser notification when a ticker crosses your target price.
          Quotes polled every 60 seconds via Yahoo Finance.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ticker" className="w-32">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
              required
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>
          <Field label="Condition" className="w-36">
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
          </Field>
          <Field label="Target price" className="w-40">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="150.00"
              required
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Add alert
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        {permission === "denied" && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Notifications are blocked in this browser. Alerts will still trigger
            and update the table here, but no system notification will fire.
          </div>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              <th className="px-4 py-3 text-right font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {!mounted && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {mounted && sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No alerts yet. Add one above to get notified when a ticker
                  crosses your target.
                </td>
              </tr>
            )}
            {mounted &&
              sorted.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-mono text-sm font-semibold">
                    {a.ticker}
                  </td>
                  <td className="px-4 py-3">
                    <ConditionBadge condition={a.condition} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {currencyFmt.format(a.targetPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge alert={a} />
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(a.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      {children}
    </label>
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
      className={`flex-1 px-3 py-2 text-sm font-medium border-r border-neutral-200 last:border-r-0 dark:border-neutral-700 transition-colors ${
        active ? activeStyles : inactive
      }`}
    >
      {children}
    </button>
  );
}

function ConditionBadge({ condition }: { condition: AlertCondition }) {
  const styles =
    condition === "above"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {condition}
    </span>
  );
}

function StatusBadge({ alert }: { alert: PriceAlert }) {
  if (!alert.triggeredAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  const triggered = new Date(alert.triggeredAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Triggered {triggered}
    </span>
  );
}
