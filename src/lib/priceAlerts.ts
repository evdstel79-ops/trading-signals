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
  email?: string;
};

export type NewPriceAlertInput = {
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
  email?: string;
};

const LEGACY_STORAGE_KEY = "trading-signals.price-alerts.v1";
const MIGRATION_FLAG = "trading-signals.price-alerts.migrated.v1";
const API_URL = "/api/price-alerts";

// In-tab cross-component sync. Components dispatch this after mutations so
// hooks elsewhere on the page re-fetch.
const UPDATE_EVENT = "trading-signals:price-alerts-updated";

function notifyUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

type ListResponse = { alerts: PriceAlert[] } | { error: string };
type SingleResponse = { alert: PriceAlert } | { error: string };

async function expectAlerts(res: Response): Promise<PriceAlert[]> {
  const data = (await res.json()) as ListResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.alerts;
}

async function expectAlert(res: Response): Promise<PriceAlert> {
  const data = (await res.json()) as SingleResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.alert;
}

export async function loadAlerts(): Promise<PriceAlert[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  return expectAlerts(res);
}

export async function addAlert(input: NewPriceAlertInput): Promise<PriceAlert> {
  const payload = {
    ticker: input.ticker.trim().toUpperCase(),
    condition: input.condition,
    targetPrice: input.targetPrice,
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
  };
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const created = await expectAlert(res);
  notifyUpdated();
  return created;
}

export async function removeAlert(id: string): Promise<void> {
  const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  notifyUpdated();
}

export async function markTriggered(id: string): Promise<PriceAlert> {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, triggeredAt: new Date().toISOString() }),
  });
  const updated = await expectAlert(res);
  notifyUpdated();
  return updated;
}

async function migrateLegacyToApi(): Promise<void> {
  if (typeof window === "undefined") return;
  let store: Storage;
  try {
    store = window.localStorage;
  } catch {
    return;
  }
  if (store.getItem(MIGRATION_FLAG) === "1") return;

  const raw = store.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }
  if (!Array.isArray(parsed)) {
    store.setItem(MIGRATION_FLAG, "1");
    return;
  }

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // best-effort
    }
  }
  try {
    store.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
  store.setItem(MIGRATION_FLAG, "1");
}

export type PriceAlertsState = {
  alerts: PriceAlert[];
  /** True once the initial fetch has settled. */
  mounted: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (input: NewPriceAlertInput) => Promise<PriceAlert>;
  remove: (id: string) => Promise<void>;
};

export function useAlerts(): PriceAlertsState {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const next = await loadAlerts();
        if (!cancelled) {
          setAlerts(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load alerts");
        }
      } finally {
        if (!cancelled) setMounted(true);
      }
    }

    (async () => {
      await migrateLegacyToApi();
      if (cancelled) return;
      await refresh();
    })();

    const onUpdate = (): void => {
      void refresh();
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  async function add(input: NewPriceAlertInput): Promise<PriceAlert> {
    const created = await addAlert(input);
    setAlerts((prev) => [created, ...prev]);
    return created;
  }

  async function remove(id: string): Promise<void> {
    await removeAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function refresh(): Promise<void> {
    try {
      const next = await loadAlerts();
      setAlerts(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    }
  }

  return { alerts, add, remove, mounted, error, refresh };
}
