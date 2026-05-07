import { NextResponse } from "next/server";
import { fetchPoliticalTrades } from "@/lib/politicalSignals";

export const revalidate = 1800;

export async function GET() {
  try {
    const trades = await fetchPoliticalTrades();
    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
