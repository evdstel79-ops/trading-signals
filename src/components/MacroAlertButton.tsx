"use client";

import { useEffect, useRef, useState } from "react";

import { useMacroAlerts } from "@/lib/macroAlerts";

const DAYS_OPTIONS = [1, 3, 7] as const;

export default function MacroAlertButton({
  event,
  date,
}: {
  event: string;
  date: string;
}) {
  const { alerts, add, mounted } = useMacroAlerts();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const existing = alerts.find(
    (a) => a.event === event && a.date === date && !a.triggeredAt,
  );

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

  function handlePick(days: number) {
    void add({ event, date, daysBeforeAlert: days });
    setOpen(false);
  }

  const filled = !!existing;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          existing
            ? `Alert active: ${existing.daysBeforeAlert} day${
                existing.daysBeforeAlert === 1 ? "" : "s"
              } before`
            : "Set alert"
        }
        aria-label={existing ? `Alert active for ${event}` : `Set alert for ${event}`}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          filled
            ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            : "text-neutral-400 hover:bg-neutral-100 hover:text-emerald-600 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-emerald-400"
        }`}
      >
        <BellIcon filled={filled} />
      </button>

      {open && mounted && (
        <div
          role="dialog"
          aria-label={`Macro alert for ${event}`}
          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Alert me before
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {DAYS_OPTIONS.map((days) => {
              const isCurrent = existing?.daysBeforeAlert === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => handlePick(days)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                  }`}
                >
                  {days} day{days === 1 ? "" : "s"}
                </button>
              );
            })}
          </div>
          {existing && (
            <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Already set for {existing.daysBeforeAlert} day
              {existing.daysBeforeAlert === 1 ? "" : "s"} before. Picking
              another option adds a second alert.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
