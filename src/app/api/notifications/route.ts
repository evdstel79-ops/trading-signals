import type { Notification as PrismaNotification } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";
import type {
  AppNotification,
  NotificationCondition,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_CONDITIONS: ReadonlySet<NotificationCondition> = new Set([
  "above",
  "below",
  "stop-loss",
  "take-profit",
  "macro",
]);

function serialize(row: PrismaNotification): AppNotification {
  const out: AppNotification = {
    id: row.id,
    ticker: row.ticker,
    condition: row.condition as NotificationCondition,
    targetPrice: row.targetPrice,
    triggeredPrice: row.triggeredPrice,
    triggeredAt: row.triggeredAt.toISOString(),
    read: row.read,
  };
  if (row.eventName) out.eventName = row.eventName;
  if (row.eventDate) out.eventDate = row.eventDate;
  return out;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    const rows = await prisma.notification.findMany({
      where: { deviceId },
      orderBy: { triggeredAt: "desc" },
    });
    return NextResponse.json({ notifications: rows.map(serialize) });
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
      triggeredPrice?: unknown;
      eventName?: unknown;
      eventDate?: unknown;
      id?: unknown;
      triggeredAt?: unknown;
      read?: unknown;
    };

    const ticker = asString(body.ticker)?.trim().toUpperCase();
    const condition = asString(body.condition);
    const targetPrice = asNumber(body.targetPrice);
    const triggeredPrice = asNumber(body.triggeredPrice);

    if (!ticker) {
      return NextResponse.json({ error: "ticker is required" }, { status: 400 });
    }
    if (
      !condition ||
      !VALID_CONDITIONS.has(condition as NotificationCondition)
    ) {
      return NextResponse.json(
        { error: "condition is invalid" },
        { status: 400 },
      );
    }
    if (targetPrice === null) {
      return NextResponse.json(
        { error: "targetPrice must be a number" },
        { status: 400 },
      );
    }
    if (triggeredPrice === null) {
      return NextResponse.json(
        { error: "triggeredPrice must be a number" },
        { status: 400 },
      );
    }

    const eventName = asString(body.eventName);
    const eventDate = asString(body.eventDate);
    const importedId = asString(body.id);
    const importedTriggered =
      asString(body.triggeredAt) &&
      Number.isFinite(Date.parse(body.triggeredAt as string))
        ? new Date(Date.parse(body.triggeredAt as string))
        : null;
    const importedRead = typeof body.read === "boolean" ? body.read : false;

    const created = await prisma.notification.create({
      data: {
        deviceId,
        ticker,
        condition,
        targetPrice,
        triggeredPrice,
        eventName: eventName ?? null,
        eventDate: eventDate ?? null,
        ...(importedId ? { id: importedId } : {}),
        ...(importedTriggered ? { triggeredAt: importedTriggered } : {}),
        read: importedRead,
      },
    });
    return NextResponse.json({ notification: serialize(created) }, { status: 201 });
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
      read?: unknown;
      markAllRead?: unknown;
    };

    if (body.markAllRead === true) {
      const result = await prisma.notification.updateMany({
        where: { deviceId, read: false },
        data: { read: true },
      });
      return NextResponse.json({ updated: result.count });
    }

    const id = asString(body.id);
    if (!id) {
      return NextResponse.json(
        { error: "id is required (or markAllRead: true)" },
        { status: 400 },
      );
    }
    const read = typeof body.read === "boolean" ? body.read : true;

    const result = await prisma.notification.updateMany({
      where: { id, deviceId },
      data: { read },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }
    const updated = await prisma.notification.findUnique({ where: { id } });
    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ notification: serialize(updated) });
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
    if (id) {
      const result = await prisma.notification.deleteMany({
        where: { id, deviceId },
      });
      return NextResponse.json({ removed: result.count });
    }
    // No id → clear all for this device.
    const result = await prisma.notification.deleteMany({
      where: { deviceId },
    });
    return NextResponse.json({ removed: result.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
