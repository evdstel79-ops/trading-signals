"use client";

import { useEffect, useState } from "react";

import type { AlertCondition } from "@/lib/priceAlerts";

export type NotificationCondition =
  | AlertCondition
  | "stop-loss"
  | "take-profit"
  | "macro";

export type AppNotification = {
  id: string;
  ticker: string;
  condition: NotificationCondition;
  targetPrice: number;
  triggeredPrice: number;
  triggeredAt: string;
  read: boolean;
  /** Macro-only: full event name (e.g. "FOMC Rate Decision"). */
  eventName?: string;
  /** Macro-only: ISO date of the event (YYYY-MM-DD). */
  eventDate?: string;
};

export type NewNotificationInput = {
  ticker: string;
  condition: NotificationCondition;
  targetPrice: number;
  triggeredPrice: number;
  eventName?: string;
  eventDate?: string;
};

const LEGACY_STORAGE_KEY = "trading-signals.notifications.v1";
const MIGRATION_FLAG = "trading-signals.notifications.migrated.v1";
const API_URL = "/api/notifications";

export const NOTIFICATIONS_UPDATED_EVENT =
  "trading-signals:notifications-updated";

function notifyUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

type ListResponse = { notifications: AppNotification[] } | { error: string };
type SingleResponse = { notification: AppNotification } | { error: string };

async function expectList(res: Response): Promise<AppNotification[]> {
  const data = (await res.json()) as ListResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.notifications;
}

async function expectOne(res: Response): Promise<AppNotification> {
  const data = (await res.json()) as SingleResponse;
  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
  }
  return data.notification;
}

export async function loadNotifications(): Promise<AppNotification[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  return expectList(res);
}

export async function addNotification(
  input: NewNotificationInput,
): Promise<AppNotification> {
  const payload = {
    ...input,
    ticker: input.ticker.trim().toUpperCase(),
  };
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const created = await expectOne(res);
  notifyUpdated();
  return created;
}

export async function markAllRead(): Promise<void> {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markAllRead: true }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  notifyUpdated();
}

export async function clearNotifications(): Promise<void> {
  const res = await fetch(API_URL, { method: "DELETE" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  notifyUpdated();
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

export type NotificationsState = {
  notifications: AppNotification[];
  unreadCount: number;
  mounted: boolean;
  error: string | null;
};

export function useNotifications(): NotificationsState {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const next = await loadNotifications();
        if (!cancelled) {
          setNotifications(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load notifications",
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
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, mounted, error };
}
