import type { WatchlistItem as PrismaWatchlistItem } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";
import { prisma } from "@/lib/prisma";
import type { WatchlistItem } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z][A-Z0-9.\-]*$/;

function serialize(row: PrismaWatchlistItem): WatchlistItem {
  return {
    ticker: row.ticker,
    addedAt: row.addedAt.toISOString(),
  };
}

function normalizeSymbol(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().toUpperCase();
  return t && TICKER_RE.test(t) ? t : null;
}

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    const rows = await prisma.watchlistItem.findMany({
      where: { deviceId },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ items: rows.map(serialize) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const body = (await req.json()) as { symbol?: unknown };
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return NextResponse.json(
        { error: "symbol must be a valid ticker (uppercase A-Z, may include digits, dots, hyphens)" },
        { status: 400 },
      );
    }
    // Compound PK on (deviceId, ticker) makes this a natural upsert: re-adding
    // the same ticker is a no-op, just refresh `addedAt` so it sorts correctly.
    const row = await prisma.watchlistItem.upsert({
      where: { deviceId_ticker: { deviceId, ticker: symbol } },
      create: { deviceId, ticker: symbol },
      update: { addedAt: new Date() },
    });
    return NextResponse.json({ item: serialize(row) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const url = new URL(req.url);
    const symbol = normalizeSymbol(url.searchParams.get("symbol"));
    if (!symbol) {
      return NextResponse.json(
        { error: "symbol query param is required" },
        { status: 400 },
      );
    }
    const result = await prisma.watchlistItem.deleteMany({
      where: { deviceId, ticker: symbol },
    });
    return NextResponse.json({ removed: result.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
