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

const STORAGE_KEY = "trading-signals.macro-alerts.v1";
export const MACRO_ALERTS_UPDATED_EVENT =
  "trading-signals:macro-alerts-updated";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadMacroAlerts(): MacroAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MacroAlert[]) : [];
  } catch {
    return [];
  }
}

export function saveMacroAlerts(alerts: MacroAlert[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  window.dispatchEvent(new CustomEvent(MACRO_ALERTS_UPDATED_EVENT));
}

export function addMacroAlert(input: {
  event: string;
  date: string;
  daysBeforeAlert: number;
}): MacroAlert {
  const alert: MacroAlert = {
    id: genId(),
    event: input.event,
    date: input.date,
    daysBeforeAlert: input.daysBeforeAlert,
    createdAt: new Date().toISOString(),
  };
  const all = loadMacroAlerts();
  all.push(alert);
  saveMacroAlerts(all);
  return alert;
}

export function removeMacroAlert(id: string): MacroAlert[] {
  const next = loadMacroAlerts().filter((a) => a.id !== id);
  saveMacroAlerts(next);
  return next;
}

export function markMacroAlertTriggered(id: string): MacroAlert[] {
  const all = loadMacroAlerts();
  const target = all.find((a) => a.id === id);
  if (target && !target.triggeredAt) {
    target.triggeredAt = new Date().toISOString();
    saveMacroAlerts(all);
  }
  return all;
}

export function useMacroAlerts() {
  const [alerts, setAlerts] = useState<MacroAlert[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAlerts(loadMacroAlerts());
    setMounted(true);
    const refresh = () => setAlerts(loadMacroAlerts());
    window.addEventListener(MACRO_ALERTS_UPDATED_EVENT, refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MACRO_ALERTS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function add(input: {
    event: string;
    date: string;
    daysBeforeAlert: number;
  }): MacroAlert {
    const created = addMacroAlert(input);
    setAlerts(loadMacroAlerts());
    return created;
  }

  function remove(id: string): void {
    removeMacroAlert(id);
    setAlerts(loadMacroAlerts());
  }

  return { alerts, add, remove, mounted };
}
