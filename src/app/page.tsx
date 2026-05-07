export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Live trading signals from political disclosures and SEC insider
          filings.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Political trades (7d)"
          value="—"
          hint="Congressional disclosures"
        />
        <StatCard
          label="Insider trades (7d)"
          value="—"
          hint="Form 4 filings"
        />
        <StatCard
          label="Top ticker"
          value="—"
          hint="Most-signaled symbol"
        />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">Recent signals</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          No signals loaded yet. Connect a data source to begin streaming
          political and insider trade activity here.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {hint}
      </div>
    </div>
  );
}
