import { NextResponse } from "next/server";
import { fetchInsiderTrades } from "@/lib/insiderSignals";

export const revalidate = 300;

export async function GET() {
  try {
    const trades = await fetchInsiderTrades();
    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
