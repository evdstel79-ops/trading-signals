import { NextResponse } from "next/server";

import { sendAlertEmail } from "@/lib/emailAlerts";
import { fetchQuotes } from "@/lib/quotes";
import type { AlertCondition } from "@/lib/priceAlerts";

export const dynamic = "force-dynamic";

function isCondition(value: string | null): value is AlertCondition {
  return value === "above" || value === "below";
}

function didTrigger(
  condition: AlertCondition,
  price: number,
  targetPrice: number,
): boolean {
  if (condition === "above") return price >= targetPrice;
  return price <= targetPrice;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
  const email =
    url.searchParams.get("email")?.trim() || process.env.ALERT_EMAIL;
  const conditionParam = url.searchParams.get("condition");
  const targetParam = url.searchParams.get("targetPrice");

  console.log("[check-alerts] request:", {
    ticker,
    email,
    condition: conditionParam,
    targetPrice: targetParam,
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    resendKeyLength: process.env.RESEND_API_KEY?.length ?? 0,
  });

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json(
      {
        error:
          "email is required (pass ?email= or set ALERT_EMAIL in .env.local)",
      },
      { status: 400 },
    );
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set in the server environment" },
      { status: 500 },
    );
  }

  try {
    const quotes = await fetchQuotes([ticker]);
    const quote = quotes[ticker];
    if (!quote) {
      return NextResponse.json(
        { error: `No quote found for ${ticker}` },
        { status: 404 },
      );
    }

    const condition: AlertCondition = isCondition(conditionParam)
      ? conditionParam
      : "above";
    const targetPrice = targetParam ? Number(targetParam) : quote.price;

    if (
      conditionParam &&
      targetParam &&
      !didTrigger(condition, quote.price, targetPrice)
    ) {
      return NextResponse.json({
        sent: false,
        reason: "condition not met",
        currentPrice: quote.price,
      });
    }

    await sendAlertEmail({
      to: email,
      ticker,
      condition,
      targetPrice,
      currentPrice: quote.price,
    });

    return NextResponse.json({
      sent: true,
      ticker,
      currentPrice: quote.price,
    });
  } catch (err) {
    const error = err as Error & { resendError?: unknown };
    console.error("[check-alerts] failed:", {
      message: error.message,
      stack: error.stack,
      resendError: error.resendError,
    });
    return NextResponse.json(
      {
        sent: false,
        error: error.message ?? "Unknown error",
        details: error.resendError ?? null,
      },
      { status: 502 },
    );
  }
}
