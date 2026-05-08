"use client";

import { useEffect, useState } from "react";

export type MacroAlert = {
  id: string;
  /** Event name, e.g. "FOMC Rate Decision". */
  event: string;
  /** ISO date of the event (YYYY-MM-DD). */
  date: string;
  daysBeforeAlert: number;
  createdAt: string;
  /** Set when the alert has fired so the polling loop doesn't re-fire it. */
  triggeredAt?: string;
};

export type NewMacroAlertInput = {
  event: string;
  date: string;
  daysBeforeAlert: number;
};

const LEGACY_STORAGE_KEY = "trading-signals.macro-alerts.v1";
const MIGRATION_FLAG = "trading-signals.macro-alerts.migrated.v1";
const API_URL = "/api/macro-alerts";

export const MACRO_ALERTS_UPDATED_EVENT =
  "trading-signals:macro-alerts-updated";

function notifyUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MACRO_ALERTS_UPDATED_EVENT));
}

type ListResponse = { alerts: MacroAlert[] } | { error: string };
type SingleResponse = { alert: MacroAlert } | { error: string };

async function expectAlerts(res: Response): Promise<MacroAlert[]> {
  const data = (await res.json()) as ListResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.alerts;
}

async function expectAlert(res: Response): Promise<MacroAlert> {
  const data = (await res.json()) as SingleResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.alert;
}

export async function loadMacroAlerts(): Promise<MacroAlert[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  return expectAlerts(res);
}

export async function addMacroAlert(
  input: NewMacroAlertInput,
): Promise<MacroAlert> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const created = await expectAlert(res);
  notifyUpdated();
  return created;
}

export async function removeMacroAlert(id: string): Promise<void> {
  const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  notifyUpdated();
}

export async function markMacroAlertTriggered(id: string): Promise<MacroAlert> {
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

export type MacroAlertsState = {
  alerts: MacroAlert[];
  mounted: boolean;
  error: string | null;
  add: (input: NewMacroAlertInput) => Promise<MacroAlert>;
  remove: (id: string) => Promise<void>;
};

export function useMacroAlerts(): MacroAlertsState {
  const [alerts, setAlerts] = useState<MacroAlert[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const next = await loadMacroAlerts();
        if (!cancelled) {
          setAlerts(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load macro alerts",
          );
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
    window.addEventListener(MACRO_ALERTS_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(MACRO_ALERTS_UPDATED_EVENT, onUpdate);
    };
  }, []);

  async function add(input: NewMacroAlertInput): Promise<MacroAlert> {
    const created = await addMacroAlert(input);
    setAlerts((prev) => [created, ...prev]);
    return created;
  }

  async function remove(id: string): Promise<void> {
    await removeMacroAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return { alerts, add, remove, mounted, error };
}
