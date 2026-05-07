import { fetchInsiderTrades, type InsiderTrade } from "@/lib/insiderSignals";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";

export const revalidate = 300;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const [politicalResult, insiderResult] = await Promise.allSettled([
    fetchPoliticalTrades(),
    fetchInsiderTrades(),
  ]);

  const political: PoliticalTrade[] =
    politicalResult.status === "fulfilled" ? politicalResult.value : [];
  const insider: InsiderTrade[] =
    insiderResult.status === "fulfilled" ? insiderResult.value : [];

  const politicalError =
    politicalResult.status === "rejected"
      ? errorMessage(politicalResult.reason)
      : null;
  const insiderError =
    insiderResult.status === "rejected"
      ? errorMessage(insiderResult.reason)
      : null;

  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const politicalLast7d = political.filter(
    (t) => parseFiledAt(t.filedAt) >= cutoff,
  ).length;
  const insiderLast7d = insider.filter(
    (t) => parseFiledAt(t.filedAt) >= cutoff,
  ).length;

  const tickerCounts = new Map<string, number>();
  for (const t of political) {
    if (t.ticker) tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) ?? 0) + 1);
  }
  for (const t of insider) {
    if (t.ticker) tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) ?? 0) + 1);
  }
  const topTicker = [...tickerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const lastUpdated = new Date();
  const lastUpdatedLabel = lastUpdated.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Live trading signals from political disclosures and SEC insider
          filings.
        </p>
      </header>

      <section className="space-y-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Political trades (7d)"
            value={
              politicalError ? "—" : politicalLast7d.toLocaleString("en-US")
            }
            hint={
              politicalError
                ? "Source unavailable"
                : `${political.length} loaded · capitoltrades.com`
            }
            error={politicalError}
          />
          <StatCard
            label="Insider trades (7d)"
            value={insiderError ? "—" : insiderLast7d.toLocaleString("en-US")}
            hint={
              insiderError
                ? "Source unavailable"
                : `${insider.length} loaded · SEC EDGAR`
            }
            error={insiderError}
          />
          <StatCard
            label="Top ticker"
            value={topTicker ? topTicker[0] : "—"}
            hint={
              topTicker
                ? `${topTicker[1]} signals across both sources`
                : "Not enough data"
            }
          />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Last updated {lastUpdatedLabel} UTC · refreshes every 5 min
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  error,
}: {
  label: string;
  value: string;
  hint: string;
  error?: string | null;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div
        className={`mt-1 text-xs ${
          error
            ? "text-red-600 dark:text-red-400"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
        title={error ?? undefined}
      >
        {hint}
      </div>
    </div>
  );
}

function parseFiledAt(s: string): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return "Unknown error";
}
