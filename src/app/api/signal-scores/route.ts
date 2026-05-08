import { NextResponse } from "next/server";

import { aggregateAllSignals } from "@/lib/aggregateSignals";

export const revalidate = 300;

export async function GET() {
  try {
    const scores = await aggregateAllSignals();
    return NextResponse.json({ scores });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
