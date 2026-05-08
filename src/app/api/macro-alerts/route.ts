import type { MacroAlert as PrismaMacroAlert } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";
import type { MacroAlert } from "@/lib/macroAlerts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function serialize(row: PrismaMacroAlert): MacroAlert {
  const out: MacroAlert = {
    id: row.id,
    event: row.event,
    date: row.date,
    daysBeforeAlert: row.daysBeforeAlert,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.triggeredAt) out.triggeredAt = row.triggeredAt.toISOString();
  return out;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNonNegativeInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v)
    ? v
    : null;
}

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    const rows = await prisma.macroAlert.findMany({
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
      event?: unknown;
      date?: unknown;
      daysBeforeAlert?: unknown;
      id?: unknown;
      createdAt?: unknown;
      triggeredAt?: unknown;
    };

    const event = asString(body.event)?.trim();
    const date = asString(body.date)?.trim();
    const daysBeforeAlert = asNonNegativeInt(body.daysBeforeAlert);
    if (!event) {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (daysBeforeAlert === null) {
      return NextResponse.json(
        { error: "daysBeforeAlert must be a non-negative integer" },
        { status: 400 },
      );
    }
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

    const created = await prisma.macroAlert.create({
      data: {
        deviceId,
        event,
        date,
        daysBeforeAlert,
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

    const result = await prisma.macroAlert.updateMany({
      where: { id, deviceId },
      data: { triggeredAt },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    const updated = await prisma.macroAlert.findUnique({ where: { id } });
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
    const result = await prisma.macroAlert.deleteMany({
      where: { id, deviceId },
    });
    return NextResponse.json({ removed: result.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
