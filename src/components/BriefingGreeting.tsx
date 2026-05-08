"use client";

import { useEffect, useState } from "react";

export default function BriefingGreeting() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Re-evaluate every minute so the greeting flips when the user crosses
    // noon / 6 pm without a page reload.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {dateStr}
      </p>
    </header>
  );
}
