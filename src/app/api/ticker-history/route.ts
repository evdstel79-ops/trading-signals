import { NextResponse } from "next/server";
import {
  fetchTickerHistory,
  isValidRange,
  type HistoryRange,
} from "@/lib/tickerHistory";

export const revalidate = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const range = url.searchParams.get("range") ?? "1mo";
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (!isValidRange(range)) {
    return NextResponse.json(
      { error: "range must be 1mo, 3mo, or 1y" },
      { status: 400 },
    );
  }
  try {
    const history = await fetchTickerHistory(ticker, range as HistoryRange);
    return NextResponse.json({ history });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
