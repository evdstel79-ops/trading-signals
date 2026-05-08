import { NextResponse } from "next/server";

import { fetchEarningsForTickers } from "@/lib/earnings";

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ earnings: [] });
  }
  try {
    const earnings = await fetchEarningsForTickers(tickers);
    return NextResponse.json({ earnings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
