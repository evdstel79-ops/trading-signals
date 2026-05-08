"use client";

import { useEffect, useState } from "react";

import type { AlertCondition } from "@/lib/priceAlerts";

export type AppNotification = {
  id: string;
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
  triggeredPrice: number;
  triggeredAt: string;
  read: boolean;
};

const STORAGE_KEY = "trading-signals.notifications.v1";
export const NOTIFICATIONS_UPDATED_EVENT =
  "trading-signals:notifications-updated";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: AppNotification[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

export function addNotification(input: {
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
  triggeredPrice: number;
}): AppNotification {
  const notification: AppNotification = {
    id: genId(),
    ticker: input.ticker.trim().toUpperCase(),
    condition: input.condition,
    targetPrice: input.targetPrice,
    triggeredPrice: input.triggeredPrice,
    triggeredAt: new Date().toISOString(),
    read: false,
  };
  const all = loadNotifications();
  all.unshift(notification);
  saveNotifications(all);
  return notification;
}

export function markAllRead(): AppNotification[] {
  const all = loadNotifications();
  let changed = false;
  for (const n of all) {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) saveNotifications(all);
  return all;
}

export function clearNotifications(): void {
  saveNotifications([]);
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNotifications(loadNotifications());
    setMounted(true);

    const refresh = () => setNotifications(loadNotifications());
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, mounted };
}
