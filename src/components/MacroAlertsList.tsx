"use client";

import { useMacroAlerts } from "@/lib/macroAlerts";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MacroAlertsList() {
  const { alerts, remove, mounted } = useMacroAlerts();

  if (!mounted) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold">Your macro alerts</h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Loading…
        </div>
      </section>
    );
  }

  if (alerts.length === 0) return null;

  const sorted = [...alerts].sort((a, b) => {
    if (!!a.triggeredAt !== !!b.triggeredAt) return a.triggeredAt ? 1 : -1;
    return a.date < b.date ? -1 : 1;
  });

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        Your macro alerts
        <span className="ml-2 text-[11px] font-normal text-neutral-500 dark:text-neutral-400">
          ({alerts.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {sorted.map((alert) => {
          const eventTs = Date.parse(alert.date);
          const daysUntil = Number.isFinite(eventTs)
            ? Math.round((eventTs - Date.now()) / DAY_MS)
            : null;
          return (
            <li
              key={alert.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span aria-hidden className="text-base">
                📊
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {alert.event}
                  {alert.triggeredAt && (
                    <span className="ml-2 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      Triggered
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {new Date(alert.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                  {" · "}
                  Alert {alert.daysBeforeAlert} day
                  {alert.daysBeforeAlert === 1 ? "" : "s"} before
                  {daysUntil !== null &&
                    !alert.triggeredAt &&
                    daysUntil > 0 && (
                      <> · in {daysUntil} day{daysUntil === 1 ? "" : "s"}</>
                    )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(alert.id)}
                className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
