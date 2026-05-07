import Link from "next/link";

export default function TickerLink({
  ticker,
  className = "",
}: {
  ticker: string;
  className?: string;
}) {
  if (!ticker) {
    return (
      <span className={`text-neutral-400 dark:text-neutral-600 ${className}`}>
        —
      </span>
    );
  }
  return (
    <Link
      href={`/ticker/${encodeURIComponent(ticker)}`}
      className={`hover:text-emerald-700 hover:underline dark:hover:text-emerald-300 ${className}`}
    >
      {ticker}
    </Link>
  );
}
