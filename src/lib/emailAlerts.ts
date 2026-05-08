import { Resend } from "resend";

import type { AlertCondition } from "@/lib/priceAlerts";

export type AlertEmailParams = {
  to: string;
  ticker: string;
  condition: AlertCondition;
  targetPrice: number;
  currentPrice: number;
};

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000"
  );
}

export async function sendAlertEmail({
  to,
  ticker,
  condition,
  targetPrice,
  currentPrice,
}: AlertEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  const resend = new Resend(apiKey);

  const target = currencyFmt.format(targetPrice);
  const current = currencyFmt.format(currentPrice);
  const verb = condition === "above" ? "rose above" : "fell below";
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const link = `${baseUrl}/ticker/${encodeURIComponent(ticker)}`;

  const subject = `🔔 Price Alert: ${ticker} hit ${current}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e5e5;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;">🔔 Price Alert Triggered</h1>
          <p style="margin:0 0 20px 0;color:#525252;font-size:14px;">
            <strong style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${ticker}</strong>
            ${verb} your target of <strong>${target}</strong>.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:8px 0;color:#737373;">Ticker</td>
              <td style="padding:8px 0;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${ticker}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#737373;border-top:1px solid #f5f5f5;">Condition</td>
              <td style="padding:8px 0;text-align:right;border-top:1px solid #f5f5f5;">${condition}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#737373;border-top:1px solid #f5f5f5;">Target price</td>
              <td style="padding:8px 0;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #f5f5f5;">${target}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#737373;border-top:1px solid #f5f5f5;">Current price</td>
              <td style="padding:8px 0;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;border-top:1px solid #f5f5f5;">${current}</td>
            </tr>
          </table>
          <div style="margin-top:24px;">
            <a href="${link}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:500;">View ${ticker}</a>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject,
    html,
  });
  if (error) {
    const err = new Error(
      `Resend error [${error.name ?? "unknown"}]: ${error.message ?? String(error)}`,
    );
    (err as Error & { resendError?: unknown }).resendError = error;
    throw err;
  }
  console.log("[emailAlerts] Resend accepted email:", data?.id);
}
