import type { PriceAlert as PrismaPriceAlert } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";
import type { AlertCondition, PriceAlert } from "@/lib/priceAlerts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_CONDITIONS: ReadonlySet<AlertCondition> = new Set([
  "above",
  "below",
]);

function serialize(row: PrismaPriceAlert): PriceAlert {
  const out: PriceAlert = {
    id: row.id,
    ticker: row.ticker,
    condition: row.condition as AlertCondition,
    targetPrice: row.targetPrice,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.triggeredAt) out.triggeredAt = row.triggeredAt.toISOString();
  if (row.email) out.email = row.email;
  return out;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asPositiveNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    const rows = await prisma.priceAlert.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ alerts: rows.map(serialize) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const body = (await req.json()) as {
      ticker?: unknown;
      condition?: unknown;
      targetPrice?: unknown;
      email?: unknown;
      id?: unknown;
      createdAt?: unknown;
      triggeredAt?: unknown;
    };

    const ticker = asString(body.ticker)?.trim().toUpperCase();
    const condition = asString(body.condition);
    const targetPrice = asPositiveNumber(body.targetPrice);
    if (!ticker) {
      return NextResponse.json({ error: "ticker is required" }, { status: 400 });
    }
    if (!condition || !VALID_CONDITIONS.has(condition as AlertCondition)) {
      return NextResponse.json(
        { error: "condition must be 'above' or 'below'" },
        { status: 400 },
      );
    }
    if (targetPrice === null) {
      return NextResponse.json(
        { error: "targetPrice must be a positive number" },
        { status: 400 },
      );
    }
    const email = asString(body.email)?.trim() || null;
    const importedId = asString(body.id);
    const importedCreated =
      asString(body.createdAt) && Number.isFinite(Date.parse(body.createdAt as string))
        ? new Date(Date.parse(body.createdAt as string))
        : null;
    const importedTriggered =
      asString(body.triggeredAt) &&
      Number.isFinite(Date.parse(body.triggeredAt as string))
        ? new Date(Date.parse(body.triggeredAt as string))
        : null;

    const created = await prisma.priceAlert.create({
      data: {
        deviceId,
        ticker,
        condition,
        targetPrice,
        email,
        ...(importedId ? { id: importedId } : {}),
        ...(importedCreated ? { createdAt: importedCreated } : {}),
        ...(importedTriggered ? { triggeredAt: importedTriggered } : {}),
      },
    });
    return NextResponse.json({ alert: serialize(created) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const body = (await req.json()) as {
      id?: unknown;
      triggeredAt?: unknown;
    };
    const id = asString(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const triggeredRaw = asString(body.triggeredAt);
    const triggeredAt: Date =
      triggeredRaw && Number.isFinite(Date.parse(triggeredRaw))
        ? new Date(Date.parse(triggeredRaw))
        : new Date();

    const result = await prisma.priceAlert.updateMany({
      where: { id, deviceId },
      data: { triggeredAt },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    const updated = await prisma.priceAlert.findUnique({ where: { id } });
    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json({ alert: serialize(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const deviceId = await getOrCreateDevice();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const result = await prisma.priceAlert.deleteMany({
      where: { id, deviceId },
    });
    return NextResponse.json({ removed: result.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
