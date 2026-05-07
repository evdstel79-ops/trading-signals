import CorrelationsTable, {
  type CorrelationRow,
} from "@/components/CorrelationsTable";
import {
  fetchPoliticalTrades,
  type PoliticalTrade,
} from "@/lib/politicalSignals";
import { detectCorrelations } from "@/lib/tradeCorrelation";

export const revalidate = 1800;

export default async function CorrelationsPage() {
  let trades: PoliticalTrade[] = [];
  let fetchError: string | null = null;
  try {
    trades = await fetchPoliticalTrades();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Unknown error";
  }

  const correlations = detectCorrelations(trades);

  // Resolve party for each politician once and pin it by index alongside the
  // names array so the client doesn't need the full trade list.
  const partyByMember = new Map<string, PoliticalTrade["party"]>();
  for (const t of trades) {
    if (!partyByMember.has(t.memberName)) {
      partyByMember.set(t.memberName, t.party);
    }
  }

  const rows: CorrelationRow[] = correlations.map((c) => ({
    ...c,
    politicianParties: c.politicians.map(
      (name) => partyByMember.get(name) ?? "Unknown",
    ),
  }));

  const maxScore = rows[0]?.correlationScore ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Correlations</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Tickers traded by multiple members of Congress within a 90-day
          window. Score weights cluster size, bipartisan participation, and
          buy concentration.
        </p>
      </header>

      {fetchError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Political trades: {fetchError}
        </div>
      )}

      <CorrelationsTable rows={rows} maxScore={maxScore} />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {rows.length} correlated tickers · {trades.length} political trades
        scanned · 90-day rolling window · score = (politicians × 2) +
        (bipartisan ? 5 : 0) + (more buys than sells ? 2 : 0)
      </p>
    </div>
  );
}
