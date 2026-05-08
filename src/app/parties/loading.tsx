import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <PartyHeroSkeleton key={i} />
        ))}
      </section>
      <SkeletonCard height="h-44" />
      <SkeletonCard height="h-56" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <ListSkeleton key={`tickers-${i}`} />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <ListSkeleton key={`pols-${i}`} />
        ))}
      </section>
    </div>
  );
}

function PartyHeroSkeleton() {
  return (
    <div className="rounded-lg border-2 border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="mt-3 h-8 w-40" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-1.5 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ height = "h-32" }: { height?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="mb-3 h-4 w-40" />
      <SkeletonBlock className={`w-full ${height}`} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="h-4 w-32" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
