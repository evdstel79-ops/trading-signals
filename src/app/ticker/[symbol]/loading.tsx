import {
  SkeletonBlock,
  SkeletonChart,
  SkeletonTable,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-3 w-24" />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SkeletonBlock className="h-7 w-20" />
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="ml-auto h-7 w-32" />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
      </div>

      <SkeletonChart />

      <section>
        <SkeletonBlock className="mb-3 h-4 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
      </section>

      <section>
        <SkeletonBlock className="mb-3 h-4 w-40" />
        <SkeletonTable rows={4} />
      </section>

      <section>
        <SkeletonBlock className="mb-3 h-4 w-40" />
        <SkeletonTable rows={4} />
      </section>
    </div>
  );
}
