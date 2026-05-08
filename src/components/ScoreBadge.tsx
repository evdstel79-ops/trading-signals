type Size = "sm" | "md";

function colorFor(score: number): string {
  if (score >= 8) {
    return "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900";
  }
  if (score >= 5) {
    return "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900";
  }
  return "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900";
}

export default function ScoreBadge({
  score,
  size = "sm",
  title,
}: {
  score: number;
  size?: Size;
  title?: string;
}) {
  const sizeClass =
    size === "md"
      ? "h-8 w-8 text-sm"
      : "h-6 w-6 text-[11px]";
  return (
    <span
      title={title ?? `Signal score ${score}/10`}
      className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${sizeClass} ${colorFor(score)}`}
    >
      {score}
    </span>
  );
}
