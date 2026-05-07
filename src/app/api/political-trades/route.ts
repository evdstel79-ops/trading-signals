import { NextResponse } from "next/server";

export const revalidate = 1800;

const CAPITOL_TRADES_URL = "https://www.capitoltrades.com/trades?pageSize=30";

type RawCapitolTrade = {
  chamber?: "house" | "senate" | string;
  pubDate?: string;
  txDate?: string;
  txType?: string;
  value?: number | null;
  issuer?: {
    issuerName?: string;
    issuerTicker?: string;
  };
  politician?: {
    firstName?: string;
    lastName?: string;
    party?: string;
  };
};

export type Party = "R" | "D" | "I" | "Unknown";

export type PoliticalTrade = {
  filedAt: string;
  memberName: string;
  chamber: "House" | "Senate";
  ticker: string;
  transactionType: "buy" | "sell" | "exchange" | "other";
  amount: string;
  party: Party;
};

function decodeRscChunks(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let decoded = "";
  for (const m of html.matchAll(re)) {
    try {
      decoded += JSON.parse(`"${m[1]}"`);
    } catch {
      // Skip malformed chunks; the trade payload lives in clean ones.
    }
  }
  return decoded;
}

function extractTradesArray(decoded: string): RawCapitolTrade[] {
  const marker = '"data":[{"_issuerId"';
  const markerStart = decoded.indexOf(marker);
  if (markerStart < 0) {
    throw new Error("Could not locate trades data in capitoltrades page");
  }
  const arrStart = markerStart + '"data":'.length;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = arrStart; i < decoded.length; i++) {
    const ch = decoded[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error("Trades array end not found while parsing capitoltrades");
  }
  return JSON.parse(decoded.slice(arrStart, end + 1)) as RawCapitolTrade[];
}

function classifyTransaction(
  type?: string,
): PoliticalTrade["transactionType"] {
  if (!type) return "other";
  const t = type.toLowerCase();
  if (t.includes("buy") || t.includes("purchase")) return "buy";
  if (t.includes("sell") || t.includes("sale") || t.includes("sold"))
    return "sell";
  if (t.includes("exchange")) return "exchange";
  return "other";
}

function classifyParty(party?: string): Party {
  switch ((party ?? "").toLowerCase()) {
    case "republican":
      return "R";
    case "democrat":
    case "democratic":
      return "D";
    case "independent":
      return "I";
    default:
      return "Unknown";
  }
}

function toTrade(raw: RawCapitolTrade): PoliticalTrade {
  const filedAt = (raw.pubDate ?? "").slice(0, 10);
  const memberName = [raw.politician?.firstName, raw.politician?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const chamber: PoliticalTrade["chamber"] =
    raw.chamber === "senate" ? "Senate" : "House";
  const tickerRaw = raw.issuer?.issuerTicker ?? "";
  const ticker = tickerRaw.split(":")[0]?.trim() ?? "";
  const amount =
    typeof raw.value === "number" && Number.isFinite(raw.value)
      ? `$${raw.value.toLocaleString("en-US")}`
      : "";

  return {
    filedAt,
    memberName: memberName || "Unknown",
    chamber,
    ticker,
    transactionType: classifyTransaction(raw.txType),
    amount,
    party: classifyParty(raw.politician?.party),
  };
}

export async function GET() {
  try {
    const res = await fetch(CAPITOL_TRADES_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TradingSignals/0.1; +https://example.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      throw new Error(`capitoltrades fetch failed: ${res.status}`);
    }
    const html = await res.text();
    const decoded = decodeRscChunks(html);
    const raw = extractTradesArray(decoded);
    const trades = raw.slice(0, 30).map(toTrade);
    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
