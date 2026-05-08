import { NextResponse } from "next/server";

import { getOrCreateDevice } from "@/lib/deviceId";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const deviceId = await getOrCreateDevice();
    return NextResponse.json({ deviceId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
