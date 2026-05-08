import { NextResponse } from "next/server";

import { fetchEarningsForTickers } from "@/lib/earnings";

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").filter(Boolean);
  console.log("[/api/earnings] tickers:", tickers);
  if (tickers.length === 0) {
    return NextResponse.json({ earnings: [] });
  }
  try {
    const earnings = await fetchEarningsForTickers(tickers);
    if (earnings.length > 0) {
      console.log(
        "[/api/earnings] first parsed entry:",
        JSON.stringify(earnings[0], null, 2),
      );
    }
    return NextResponse.json({ earnings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.log("[/api/earnings] threw:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
