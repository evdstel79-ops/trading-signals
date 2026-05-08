import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const DEVICE_COOKIE = "trading-signals-device-id";
const ONE_YEAR_S = 365 * 24 * 60 * 60;

/**
 * Read the device id from the request cookie. Returns a fresh UUID when no
 * cookie is set, but does NOT persist it — Server Components can't write
 * cookies. Use `ensureDeviceCookie()` (Route Handlers) when you need the id
 * to stick across requests.
 */
export async function getDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  return existing ?? randomUUID();
}

/**
 * Read or create the device id, persisting it on the response. Must be
 * called from a Route Handler or Server Action.
 */
export async function ensureDeviceCookie(): Promise<{
  deviceId: string;
  isNew: boolean;
}> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing) return { deviceId: existing, isNew: false };
  const deviceId = randomUUID();
  store.set({
    name: DEVICE_COOKIE,
    value: deviceId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_S,
  });
  return { deviceId, isNew: true };
}

/**
 * Ensure the cookie + Device row exist. Returns the device id. Use at the
 * top of any Route Handler that needs to insert child rows (paper trades,
 * alerts, etc.) so the FK target is guaranteed to exist.
 */
export async function getOrCreateDevice(): Promise<string> {
  const { deviceId } = await ensureDeviceCookie();
  await prisma.device.upsert({
    where: { id: deviceId },
    create: { id: deviceId },
    update: {},
  });
  return deviceId;
}
