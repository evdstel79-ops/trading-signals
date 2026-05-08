import type { PaperTrade as PrismaPaperTrade } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";
import type {
  PaperTrade,
  PaperTradeDirection,
} from "@/lib/paperTrades";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CreateInput = {
  ticker: unknown;
  direction: unknown;
  quantity: unknown;
  entryPrice: unknown;
  note?: unknown;
  source?: unknown;
  stopLoss?: unknown;
  takeProfit?: unknown;
  tags?: unknown;
  /** When migrating from localStorage we want to preserve original ids/timestamps. */
  id?: unknown;
  addedAt?: unknown;
};

type UpdateInput = {
  id: unknown;
  closedAt?: unknown;
  exitPrice?: unknown;
  note?: unknown;
  stopLoss?: unknown;
  takeProfit?: unknown;
  tags?: unknown;
};

const VALID_DIRECTIONS: ReadonlySet<PaperTradeDirection> = new Set([
  "buy",
  "sell",
]);
const VALID_SOURCES: ReadonlySet<NonNullable<PaperTrade["source"]>> = new Set([
  "political",
  "insider",
  "manual",
]);

function serialize(t: PrismaPaperTrade): PaperTrade {
  return {
    id: t.id,
    ticker: t.ticker,
    direction: t.direction as PaperTradeDirection,
    quantity: t.quantity,
    entryPrice: t.entryPrice,
    note: t.note,
    addedAt: t.addedAt.toISOString(),
    source: t.source ? (t.source as PaperTrade["source"]) : undefined,
    closedAt: t.closedAt?.toISOString(),
    exitPrice: t.exitPrice ?? undefined,
    stopLoss: t.stopLoss,
    takeProfit: t.takeProfit,
    tags: t.tags,
  };
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asPositiveNumber(v: unknown): number | null {
  const n = asNumber(v);
  return n !== null && n > 0 ? n : null;
}

function asNullableNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return asNumber(v);
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.every((x): x is string => typeof x === "string") ? v : null;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const ts = Date.parse(v);
  return Number.isFinite(ts) ? new Date(ts) : null;
}

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    const rows = await prisma.paperTrade.findMany({
      where: { deviceId },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ trades: rows.map(serialize) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const body = (await req.json()) as CreateInput;

    const ticker = asString(body.ticker)?.trim().toUpperCase();
    const direction = asString(body.direction);
    const quantity = asPositiveNumber(body.quantity);
    const entryPrice = asPositiveNumber(body.entryPrice);

    if (!ticker) {
      return NextResponse.json({ error: "ticker is required" }, { status: 400 });
    }
    if (!direction || !VALID_DIRECTIONS.has(direction as PaperTradeDirection)) {
      return NextResponse.json(
        { error: "direction must be 'buy' or 'sell'" },
        { status: 400 },
      );
    }
    if (quantity === null) {
      return NextResponse.json(
        { error: "quantity must be a positive number" },
        { status: 400 },
      );
    }
    if (entryPrice === null) {
      return NextResponse.json(
        { error: "entryPrice must be a positive number" },
        { status: 400 },
      );
    }

    const note = asString(body.note)?.trim() ?? "";
    const source = asString(body.source);
    const sourceClean =
      source && VALID_SOURCES.has(source as NonNullable<PaperTrade["source"]>)
        ? source
        : null;
    const stopLoss = asNullableNumber(body.stopLoss) ?? null;
    const takeProfit = asNullableNumber(body.takeProfit) ?? null;
    const tags = asStringArray(body.tags) ?? [];
    const importedId = asString(body.id);
    const importedAddedAt = asDate(body.addedAt);

    const created = await prisma.paperTrade.create({
      data: {
        deviceId,
        ticker,
        direction,
        quantity,
        entryPrice,
        note,
        source: sourceClean,
        stopLoss,
        takeProfit,
        tags,
        ...(importedId ? { id: importedId } : {}),
        ...(importedAddedAt ? { addedAt: importedAddedAt } : {}),
      },
    });
    return NextResponse.json({ trade: serialize(created) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const body = (await req.json()) as UpdateInput;

    const id = asString(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: {
      note?: string;
      closedAt?: Date | null;
      exitPrice?: number | null;
      stopLoss?: number | null;
      takeProfit?: number | null;
      tags?: string[];
    } = {};

    if (body.note !== undefined) {
      const note = asString(body.note);
      if (note === null) {
        return NextResponse.json({ error: "note must be a string" }, { status: 400 });
      }
      data.note = note.trim();
    }
    if (body.closedAt !== undefined) {
      if (body.closedAt === null) {
        data.closedAt = null;
      } else {
        const d = asDate(body.closedAt);
        if (!d) {
          return NextResponse.json(
            { error: "closedAt must be ISO date string or null" },
            { status: 400 },
          );
        }
        data.closedAt = d;
      }
    }
    if (body.exitPrice !== undefined) {
      const v = asNullableNumber(body.exitPrice);
      data.exitPrice = v === undefined ? null : v;
    }
    if (body.stopLoss !== undefined) {
      const v = asNullableNumber(body.stopLoss);
      data.stopLoss = v === undefined ? null : v;
    }
    if (body.takeProfit !== undefined) {
      const v = asNullableNumber(body.takeProfit);
      data.takeProfit = v === undefined ? null : v;
    }
    if (body.tags !== undefined) {
      const t = asStringArray(body.tags);
      if (!t) {
        return NextResponse.json(
          { error: "tags must be an array of strings" },
          { status: 400 },
        );
      }
      data.tags = t;
    }

    const result = await prisma.paperTrade.updateMany({
      where: { id, deviceId },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    const updated = await prisma.paperTrade.findUnique({ where: { id } });
    if (!updated) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    return NextResponse.json({ trade: serialize(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Soft delete: mark the trade as closed at entry price (P&L = 0). The row
 * stays in the database so backtests / history don't rewrite themselves
 * when the user clears clutter.
 */
export async function DELETE(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const existing = await prisma.paperTrade.findFirst({
      where: { id, deviceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    const updated = await prisma.paperTrade.update({
      where: { id },
      data: {
        closedAt: existing.closedAt ?? new Date(),
        exitPrice: existing.exitPrice ?? existing.entryPrice,
      },
    });
    return NextResponse.json({ trade: serialize(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
