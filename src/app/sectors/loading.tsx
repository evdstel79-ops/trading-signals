import {
  SkeletonBlock,
  SkeletonChart,
  SkeletonHeader,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonChart height="h-32" />
      <SkeletonChart height="h-72" />
      <SkeletonChart height="h-80" />
      <section>
        <SkeletonBlock className="mb-3 h-4 w-40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <SkeletonBlock className="h-4 w-32" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((__, j) => (
                  <SkeletonBlock key={j} className="h-3 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
