import { NextResponse } from "next/server";
import { fetchQuotes, fetchQuotesLite } from "@/lib/quotes";

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").filter(Boolean);
  const lite = url.searchParams.get("lite") === "1";
  const quotes = lite
    ? await fetchQuotesLite(tickers)
    : await fetchQuotes(tickers);
  return NextResponse.json({ quotes });
}
