"use client";

import { useEffect } from "react";
import { loadAlerts, saveAlerts, type PriceAlert } from "@/lib/priceAlerts";

const POLL_MS = 60_000;
const INITIAL_DELAY_MS = 5_000;

type Quote = { price: number; currency: string; symbol: string };
type QuotesResponse = { quotes: Record<string, Quote | null> };

export default function AlertsManager() {
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled) return;
      try {
        const active = loadAlerts().filter((a) => !a.triggeredAt);
        if (active.length > 0) {
          const tickers = Array.from(new Set(active.map((a) => a.ticker)));
          const res = await fetch(
            `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
            { cache: "no-store" },
          );
          if (res.ok) {
            const data = (await res.json()) as QuotesResponse;
            const quotes = data.quotes ?? {};
            const all = loadAlerts();
            let changed = false;
            const now = new Date().toISOString();
            for (const alert of all) {
              if (alert.triggeredAt) continue;
              const quote = quotes[alert.ticker];
              if (!quote) continue;
              if (didTrigger(alert, quote.price)) {
                alert.triggeredAt = now;
                changed = true;
                fireNotification(alert, quote.price);
              }
            }
            if (changed) saveAlerts(all);
          }
        }
      } catch {
        // Swallow — next tick will retry.
      } finally {
        if (!cancelled) timeout = setTimeout(tick, POLL_MS);
      }
    }

    timeout = setTimeout(tick, INITIAL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return null;
}

function didTrigger(alert: PriceAlert, price: number): boolean {
  if (alert.condition === "above") return price >= alert.targetPrice;
  return price <= alert.targetPrice;
}

function fireNotification(alert: PriceAlert, price: number): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const verb = alert.condition === "above" ? "rose above" : "fell below";
  const target = `$${alert.targetPrice.toLocaleString("en-US")}`;
  const current = `$${price.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
  try {
    new Notification(`${alert.ticker} ${verb} ${target}`, {
      body: `Now trading at ${current}`,
      tag: alert.id,
    });
  } catch {
    // Some browsers reject Notification construction in insecure contexts.
  }
}
