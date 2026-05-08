import Link from "next/link";

import ScoreBadge from "@/components/ScoreBadge";
import { aggregateTopSignals, type RankedSignal } from "@/lib/aggregateSignals";

export default async function TopSignals() {
  let signals: RankedSignal[] = [];
  try {
    signals = await aggregateTopSignals(5);
  } catch {
    signals = [];
  }

  if (signals.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Top swing-trade signals
        </h2>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No scored signals available right now.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Top swing-trade signals
        </h2>
        <Link
          href="/signals"
          className="text-xs text-neutral-500 hover:text-emerald-700 hover:underline dark:text-neutral-400 dark:hover:text-emerald-300"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {signals.map((s) => (
          <SignalCard key={s.ticker} signal={s} />
        ))}
      </div>
    </section>
  );
}

function SignalCard({ signal }: { signal: RankedSignal }) {
  return (
    <Link
      href={`/ticker/${encodeURIComponent(signal.ticker)}`}
      className="group flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-600"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xl font-bold tracking-tight text-neutral-900 group-hover:text-emerald-700 dark:text-neutral-100 dark:group-hover:text-emerald-300">
          {signal.ticker}
        </span>
        <ScoreBadge score={signal.score.score} size="md" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {signal.score.reasons.map((reason) => (
          <span
            key={reason}
            className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {reason}
          </span>
        ))}
      </div>
    </Link>
  );
}
