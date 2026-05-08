"use client";

import { useEffect } from "react";
import {
  loadMacroAlerts,
  markMacroAlertTriggered,
  type MacroAlert,
} from "@/lib/macroAlerts";
import { addNotification } from "@/lib/notifications";
import {
  closePaperTrade,
  loadPaperTrades,
  type PaperTrade,
} from "@/lib/paperTrades";
import { loadAlerts, saveAlerts, type PriceAlert } from "@/lib/priceAlerts";

const DAY_MS = 24 * 60 * 60 * 1000;

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
        // Macro alerts don't need any network call.
        processMacroAlerts(loadMacroAlerts());

        const activeAlerts = loadAlerts().filter((a) => !a.triggeredAt);
        const allPaperTrades = await loadPaperTrades().catch(
          (): PaperTrade[] => [],
        );
        const slTpTrades = allPaperTrades.filter(
          (t) => !t.closedAt && (t.stopLoss != null || t.takeProfit != null),
        );

        const tickers = Array.from(
          new Set([
            ...activeAlerts.map((a) => a.ticker),
            ...slTpTrades.map((t) => t.ticker),
          ]),
        );
        if (tickers.length === 0) return;

        const res = await fetch(
          `/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as QuotesResponse;
        const quotes = data.quotes ?? {};

        // Price alerts.
        if (activeAlerts.length > 0) {
          const all = loadAlerts();
          let changed = false;
          const now = new Date().toISOString();
          for (const alert of all) {
            if (alert.triggeredAt) continue;
            const quote = quotes[alert.ticker];
            if (!quote) continue;
            if (didTriggerAlert(alert, quote.price)) {
              alert.triggeredAt = now;
              changed = true;
              fireAlertBrowserNotification(alert, quote.price);
              fireEmail(alert);
              addNotification({
                ticker: alert.ticker,
                condition: alert.condition,
                targetPrice: alert.targetPrice,
                triggeredPrice: quote.price,
              });
            }
          }
          if (changed) saveAlerts(all);
        }

        // Paper-trade stop-loss / take-profit.
        for (const trade of slTpTrades) {
          const quote = quotes[trade.ticker];
          if (!quote) continue;
          const trigger = paperTradeTrigger(trade, quote.price);
          if (!trigger) continue;
          try {
            await closePaperTrade(trade.id, quote.price);
          } catch {
            // If the close API fails we'll re-evaluate on the next tick.
            continue;
          }
          addNotification({
            ticker: trade.ticker,
            condition: trigger.condition,
            targetPrice: trigger.level,
            triggeredPrice: quote.price,
          });
          firePaperTradeBrowserNotification(
            trade.ticker,
            trigger.condition,
            quote.price,
            trade.id,
          );
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

function didTriggerAlert(alert: PriceAlert, price: number): boolean {
  if (alert.condition === "above") return price >= alert.targetPrice;
  return price <= alert.targetPrice;
}

function paperTradeTrigger(
  trade: PaperTrade,
  price: number,
): { condition: "stop-loss" | "take-profit"; level: number } | null {
  if (trade.stopLoss != null && price <= trade.stopLoss) {
    return { condition: "stop-loss", level: trade.stopLoss };
  }
  if (trade.takeProfit != null && price >= trade.takeProfit) {
    return { condition: "take-profit", level: trade.takeProfit };
  }
  return null;
}

function fireEmail(alert: PriceAlert): void {
  const email = alert.email?.trim();
  if (!email) return;
  const params = new URLSearchParams({
    ticker: alert.ticker,
    email,
    condition: alert.condition,
    targetPrice: String(alert.targetPrice),
  });
  const url = `/api/check-alerts?${params.toString()}`;
  console.log("[AlertsManager] Calling check-alerts:", url);
  fetch(url, { cache: "no-store" })
    .then(async (res) => {
      const body = await res.text();
      console.log(
        "[AlertsManager] check-alerts response:",
        res.status,
        body,
      );
    })
    .catch((err) => {
      console.log("[AlertsManager] check-alerts failed:", err);
    });
}

function fireAlertBrowserNotification(alert: PriceAlert, price: number): void {
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

function processMacroAlerts(alerts: MacroAlert[]): void {
  const now = Date.now();
  for (const alert of alerts) {
    if (alert.triggeredAt) continue;
    const eventTs = Date.parse(alert.date);
    if (!Number.isFinite(eventTs)) continue;
    const fireAt = eventTs - alert.daysBeforeAlert * DAY_MS;
    if (now < fireAt) continue;
    // Don't fire alerts whose event is already in the past — that's a stale
    // record the user didn't get to in time.
    if (eventTs < now) {
      markMacroAlertTriggered(alert.id);
      continue;
    }
    const daysLeft = Math.max(0, Math.round((eventTs - now) / DAY_MS));
    markMacroAlertTriggered(alert.id);
    fireMacroBrowserNotification(alert, daysLeft);
    addNotification({
      ticker: "MACRO",
      condition: "macro",
      targetPrice: alert.daysBeforeAlert,
      triggeredPrice: daysLeft,
      eventName: alert.event,
      eventDate: alert.date,
    });
  }
}

function fireMacroBrowserNotification(
  alert: MacroAlert,
  daysLeft: number,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const dateLabel = new Date(alert.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const dayWord = daysLeft === 1 ? "day" : "days";
  try {
    new Notification(
      `📊 ${alert.event} in ${daysLeft} ${dayWord} — ${dateLabel}`,
      { tag: `macro-${alert.id}` },
    );
  } catch {
    // Some browsers reject Notification construction in insecure contexts.
  }
}

function firePaperTradeBrowserNotification(
  ticker: string,
  condition: "stop-loss" | "take-profit",
  price: number,
  tradeId: string,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const current = `$${price.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
  const title =
    condition === "stop-loss"
      ? `📉 Stop-loss triggered: ${ticker} closed at ${current}`
      : `🎯 Take-profit triggered: ${ticker} closed at ${current}`;
  try {
    new Notification(title, {
      body: "Paper position auto-closed.",
      tag: `paper-${tradeId}`,
    });
  } catch {
    // Some browsers reject Notification construction in insecure contexts.
  }
}
