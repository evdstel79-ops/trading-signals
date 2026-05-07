import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/quotes";

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").filter(Boolean);
  const quotes = await fetchQuotes(tickers);
  return NextResponse.json({ quotes });
}
