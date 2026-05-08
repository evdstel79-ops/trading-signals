"use client";

import { useEffect, useRef, useState } from "react";

import TickerLink from "@/components/TickerLink";
import {
  clearNotifications,
  markAllRead,
  useNotifications,
  type AppNotification,
} from "@/lib/notifications";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function NotificationCenter() {
  const { notifications, unreadCount, mounted } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-base text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden>🔔</span>
        {mounted && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-neutral-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {notifications.length}{" "}
              {notifications.length === 1 ? "item" : "items"}
            </span>
          </div>

          <ul className="max-h-80 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
            {!mounted && (
              <li className="px-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Loading…
              </li>
            )}
            {mounted && notifications.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No notifications yet. They&apos;ll appear here when a price
                alert triggers.
              </li>
            )}
            {mounted &&
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
          </ul>

          {mounted && notifications.length > 0 && (
            <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={unreadCount === 0}
                className="text-xs font-medium text-neutral-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-emerald-300"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => clearNotifications()}
                className="text-xs font-medium text-neutral-600 hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
}: {
  notification: AppNotification;
}) {
  const target = currencyFmt.format(notification.targetPrice);
  const triggered = currencyFmt.format(notification.triggeredPrice);
  const highlight = notification.read
    ? ""
    : "bg-emerald-50/60 dark:bg-emerald-950/20";
  return (
    <li
      className={`flex items-start gap-2 px-3 py-2.5 text-xs ${highlight}`}
    >
      {!notification.read && (
        <span
          aria-hidden
          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
        />
      )}
      <div className={`min-w-0 flex-1 ${notification.read ? "pl-3.5" : ""}`}>
        <div className="font-mono text-sm font-semibold">
          <TickerLink ticker={notification.ticker} />
        </div>
        <div className="text-neutral-700 dark:text-neutral-300">
          {describeCondition(notification.condition, target)} at{" "}
          <span className="font-mono">{triggered}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          {formatRelative(notification.triggeredAt)}
        </div>
      </div>
    </li>
  );
}

function describeCondition(
  condition: AppNotification["condition"],
  target: string,
): string {
  switch (condition) {
    case "above":
      return `crossed above ${target}`;
    case "below":
      return `crossed below ${target}`;
    case "stop-loss":
      return `📉 stop-loss hit at ${target}`;
    case "take-profit":
      return `🎯 take-profit hit at ${target}`;
  }
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
