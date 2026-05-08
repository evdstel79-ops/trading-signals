export function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-2 h-6 w-32" />
      <SkeletonBlock className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonChart({
  height = "h-72",
}: {
  height?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="mb-3 h-4 w-48" />
      <SkeletonBlock className={`w-full ${height}`} />
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <SkeletonBlock className="h-3 w-32" />
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 px-4 py-3"
          >
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div>
      <SkeletonBlock className="h-7 w-48" />
      <SkeletonBlock className="mt-2 h-3 w-72" />
    </div>
  );
}
