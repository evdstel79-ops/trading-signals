import {
  SkeletonChart,
  SkeletonHeader,
  SkeletonStatCard,
  SkeletonTable,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </section>
      <SkeletonChart />
      <SkeletonTable rows={8} />
    </div>
  );
}
