"use client";

import { useWatchlist } from "@/lib/watchlist";

type Props = {
  ticker: string;
};

export default function WatchlistButton({ ticker }: Props) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  if (!ticker) return null;
  const watched = isInWatchlist(ticker);

  async function handleToggle() {
    if (watched) {
      await removeFromWatchlist(ticker);
    } else {
      await addToWatchlist(ticker);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={
        watched ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`
      }
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={watched}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 transition-colors lg:min-h-0 lg:min-w-0 ${
        watched
          ? "text-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
          : "text-neutral-300 hover:bg-neutral-100 hover:text-amber-500 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-amber-400"
      }`}
    >
      <StarIcon filled={watched} />
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
