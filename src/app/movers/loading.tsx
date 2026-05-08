import {
  SkeletonBlock,
  SkeletonChart,
  SkeletonHeader,
  SkeletonStatCard,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </section>
      <SkeletonChart height="h-72" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <MoversListSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}

function MoversListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <SkeletonBlock className="h-3 w-28" />
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
          >
            <SkeletonBlock className="h-3 w-3" />
            <div className="space-y-1.5">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-2 w-44" />
            </div>
            <SkeletonBlock className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
