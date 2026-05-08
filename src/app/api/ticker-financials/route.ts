import { NextResponse } from "next/server";

import { fetchTickerFinancials } from "@/lib/tickerFinancials";

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  try {
    const financials = await fetchTickerFinancials(ticker);
    return NextResponse.json({ financials });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
