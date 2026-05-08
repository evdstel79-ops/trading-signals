"use client";

import { useWatchlist } from "@/lib/watchlist";

export default function NewsQuickCount() {
  const { items, mounted } = useWatchlist();
  if (!mounted) return <span>—</span>;
  if (items.length === 0) return <span>Add tickers to your watchlist</span>;
  return (
    <span>
      Tracking {items.length} ticker{items.length === 1 ? "" : "s"}
    </span>
  );
}
