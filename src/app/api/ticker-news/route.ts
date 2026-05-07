import { NextResponse } from "next/server";
import { fetchTickerNews } from "@/lib/tickerNews";

export const revalidate = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  try {
    const news = await fetchTickerNews(ticker);
    return NextResponse.json({ news });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
