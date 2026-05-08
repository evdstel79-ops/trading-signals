const CAPITOL_TRADES_BASE_URL = "https://www.capitoltrades.com/trades?pageSize=30";
const PAGES_TO_FETCH = 10;

type RawCapitolTrade = {
  _txId?: number | string;
  chamber?: "house" | "senate" | string;
  pubDate?: string;
  txDate?: string;
  txType?: string;
  value?: number | null;
  price?: number | null;
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
  /** Display string. STOCK Act disclosure bracket (e.g. "$1,001–$15,000"), exact dollar amount, or "—". */
  amount: string;
  /** Numeric value for sorting. Bracket midpoint when a range is disclosed; exact amount otherwise. */
  value: number;
  /** Per-share price at trade time, as estimated by capitoltrades (typically the day's close). Null if unavailable. */
  tradePrice: number | null;
  /** Trade execution date (YYYY-MM-DD) — typically earlier than filedAt. */
  txDate: string;
  party: Party;
};

// STOCK Act disclosure brackets. Members report a range, not a precise figure;
// capitoltrades surfaces the bracket midpoint in its `value` field. Map back to the range.
const STOCK_ACT_BRACKETS: ReadonlyArray<{ midpoint: number; label: string }> = [
  { midpoint: 8000, label: "$1,001–$15,000" },
  { midpoint: 32500, label: "$15,001–$50,000" },
  { midpoint: 75000, label: "$50,001–$100,000" },
  { midpoint: 175000, label: "$100,001–$250,000" },
  { midpoint: 375000, label: "$250,001–$500,000" },
  { midpoint: 750000, label: "$500,001–$1,000,000" },
  { midpoint: 3000000, label: "$1,000,001–$5,000,000" },
  { midpoint: 15000000, label: "$5,000,001–$25,000,000" },
  { midpoint: 37500000, label: "$25,000,001–$50,000,000" },
];

function formatDisclosureAmount(rawValue: number | null | undefined): string {
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
    return "—";
  }
  const bracket = STOCK_ACT_BRACKETS.find((b) => b.midpoint === rawValue);
  if (bracket) return bracket.label;
  if (rawValue >= 50000001) return "$50,000,000+";
  return `$${rawValue.toLocaleString("en-US")}`;
}

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
  const value =
    typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : 0;
  const amount = formatDisclosureAmount(raw.value);
  const tradePrice =
    typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price > 0
      ? raw.price
      : null;

  return {
    filedAt,
    memberName: memberName || "Unknown",
    chamber,
    ticker,
    transactionType: classifyTransaction(raw.txType),
    amount,
    value,
    tradePrice,
    txDate: raw.txDate ?? "",
    party: classifyParty(raw.politician?.party),
  };
}

async function fetchPage(page: number): Promise<RawCapitolTrade[]> {
  const url =
    page === 1
      ? CAPITOL_TRADES_BASE_URL
      : `${CAPITOL_TRADES_BASE_URL}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TradingSignals/0.1; +https://example.com)",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    throw new Error(`capitoltrades page ${page} fetch failed: ${res.status}`);
  }
  const html = await res.text();
  return extractTradesArray(decodeRscChunks(html));
}

export async function fetchPoliticalTrades(): Promise<PoliticalTrade[]> {
  const pageNumbers = Array.from({ length: PAGES_TO_FETCH }, (_, i) => i + 1);
  const results = await Promise.allSettled(pageNumbers.map(fetchPage));

  // Surface a hard error only when the very first page fails — losing a later
  // page is degraded but not catastrophic.
  if (results[0].status === "rejected") {
    throw results[0].reason instanceof Error
      ? results[0].reason
      : new Error("capitoltrades page 1 fetch failed");
  }

  const seenTxIds = new Set<string>();
  const combined: RawCapitolTrade[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const trade of r.value) {
      const id = trade._txId != null ? String(trade._txId) : null;
      if (id) {
        if (seenTxIds.has(id)) continue;
        seenTxIds.add(id);
      }
      combined.push(trade);
    }
  }

  // Newest-first by publication date. Stable enough for our use cases:
  // dashboard "last 7d", politicians, correlations, etc.
  combined.sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""));
  return combined.map(toTrade);
}
