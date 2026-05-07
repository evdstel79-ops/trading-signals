"use client";

import { useEffect, useState } from "react";

export type AlertCondition = "above" | "below";

export type PriceAlert = {
  id: string;
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
  createdAt: string;
  triggeredAt?: string;
};

const STORAGE_KEY = "trading-signals.price-alerts.v1";

// In-tab cross-component sync: AlertsManager dispatches this when it mutates
// the alert list (e.g. setting triggeredAt) so any open page re-reads.
const UPDATE_EVENT = "trading-signals:price-alerts-updated";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function addAlert(input: {
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
}): PriceAlert {
  const alert: PriceAlert = {
    id: genId(),
    ticker: input.ticker.trim().toUpperCase(),
    condition: input.condition,
    targetPrice: input.targetPrice,
    createdAt: new Date().toISOString(),
  };
  const all = loadAlerts();
  all.push(alert);
  saveAlerts(all);
  return alert;
}

export function removeAlert(id: string): PriceAlert[] {
  const next = loadAlerts().filter((a) => a.id !== id);
  saveAlerts(next);
  return next;
}

export function markTriggered(id: string): PriceAlert[] {
  const all = loadAlerts();
  const target = all.find((a) => a.id === id);
  if (target && !target.triggeredAt) {
    target.triggeredAt = new Date().toISOString();
    saveAlerts(all);
  }
  return all;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAlerts(loadAlerts());
    setMounted(true);

    const refresh = () => setAlerts(loadAlerts());
    window.addEventListener(UPDATE_EVENT, refresh);
    // Cross-tab sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function add(input: {
    ticker: string;
    condition: AlertCondition;
    targetPrice: number;
  }): PriceAlert {
    const created = addAlert(input);
    setAlerts(loadAlerts());
    return created;
  }

  function remove(id: string): void {
    removeAlert(id);
    setAlerts(loadAlerts());
  }

  return { alerts, add, remove, mounted };
}
