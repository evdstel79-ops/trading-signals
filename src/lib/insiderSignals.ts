const SEC_USER_AGENT = "Trading Signals Research evdstel79@gmail.com";

const SEARCH_URL =
  "https://efts.sec.gov/LATEST/search-index?q=%22form+4%22&dateRange=custom&startdt=2026-04-01&enddt=2026-05-07&forms=4";

type SearchHit = {
  _id?: string;
  _source: {
    ciks: string[];
    display_names?: string[];
    file_date: string;
    form: string;
    adsh: string;
  };
};

type SearchResponse = {
  hits?: { hits?: SearchHit[] };
};

type DirectoryItem = { name: string; type?: string };
type DirectoryResponse = {
  directory?: { item?: DirectoryItem[] };
};

export type InsiderTrade = {
  filedAt: string;
  insiderName: string;
  companyName: string;
  ticker: string;
  transactionType: "buy" | "sell" | "other";
  shares: number;
  value: number;
  filingUrl: string;
};

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      Accept: "application/json,text/xml,*/*",
    },
    next: { revalidate: 300 },
  });
}

async function fetchSearchIndex(): Promise<SearchHit[]> {
  const res = await secFetch(SEARCH_URL);
  if (!res.ok) {
    throw new Error(`EDGAR search failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as SearchResponse;
  return json.hits?.hits ?? [];
}

async function fetchForm4Xml(
  cik: string,
  adsh: string,
): Promise<{ xml: string; filingUrl: string } | null> {
  const cikNum = cik.replace(/^0+/, "");
  const accNoDashes = adsh.replace(/-/g, "");
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}`;
  const filingUrl = `${baseUrl}/${adsh}-index.html`;

  const indexRes = await secFetch(`${baseUrl}/index.json`);
  if (!indexRes.ok) return null;
  const indexJson = (await indexRes.json()) as DirectoryResponse;
  const items = indexJson.directory?.item ?? [];

  const xmlItem =
    items.find(
      (f) =>
        f.name.toLowerCase().endsWith(".xml") &&
        !f.name.toLowerCase().startsWith("xsl") &&
        !f.name.toLowerCase().endsWith(".xsd") &&
        f.name.toLowerCase() !== "filingsummary.xml",
    ) ?? null;
  if (!xmlItem) return null;

  const xmlRes = await secFetch(`${baseUrl}/${xmlItem.name}`);
  if (!xmlRes.ok) return null;
  const xml = await xmlRes.text();
  return { xml, filingUrl };
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`));
  return m?.[1]?.trim() ?? "";
}

function pickValue(block: string, tag: string): string {
  const m = block.match(
    new RegExp(`<${tag}>[\\s\\S]*?<value>\\s*([\\s\\S]*?)\\s*<\\/value>`),
  );
  return m?.[1]?.trim() ?? "";
}

function parseForm4(
  xml: string,
): Pick<
  InsiderTrade,
  "insiderName" | "companyName" | "ticker" | "transactionType" | "shares" | "value"
> | null {
  const insiderName = pick(xml, "rptOwnerName");
  const companyName = pick(xml, "issuerName");
  const ticker = pick(xml, "issuerTradingSymbol");

  if (!insiderName && !companyName) return null;

  const txBlocks: string[] = [];
  for (const re of [
    /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g,
    /<derivativeTransaction>([\s\S]*?)<\/derivativeTransaction>/g,
  ]) {
    for (const m of xml.matchAll(re)) {
      txBlocks.push(m[1]);
    }
  }

  let totalShares = 0;
  let totalValue = 0;
  let firstCode = "";

  for (const block of txBlocks) {
    const shares = parseFloat(pickValue(block, "transactionShares"));
    const price = parseFloat(pickValue(block, "transactionPricePerShare"));
    const code = pickValue(block, "transactionAcquiredDisposedCode");
    if (!firstCode && code) firstCode = code;
    if (!Number.isNaN(shares)) totalShares += shares;
    if (!Number.isNaN(shares) && !Number.isNaN(price)) {
      totalValue += shares * price;
    }
  }

  const transactionType: "buy" | "sell" | "other" =
    firstCode === "A" ? "buy" : firstCode === "D" ? "sell" : "other";

  return {
    insiderName,
    companyName,
    ticker,
    transactionType,
    shares: totalShares,
    value: totalValue,
  };
}

function tickerFromDisplayName(displayName?: string): string {
  if (!displayName) return "";
  const m = displayName.match(/\(([A-Z0-9.\-]+)\)/);
  return m?.[1] ?? "";
}

export async function fetchInsiderTrades(): Promise<InsiderTrade[]> {
  const hits = await fetchSearchIndex();
  const top = hits.slice(0, 20);

  const results = await Promise.all(
    top.map(async (hit): Promise<InsiderTrade | null> => {
      const cik = hit._source.ciks?.[0];
      const adsh = hit._source.adsh;
      const filedAt = hit._source.file_date;
      if (!cik || !adsh) return null;

      try {
        const fetched = await fetchForm4Xml(cik, adsh);
        if (!fetched) return null;
        const parsed = parseForm4(fetched.xml);
        if (!parsed) return null;

        return {
          filedAt,
          ...parsed,
          ticker:
            parsed.ticker ||
            tickerFromDisplayName(hit._source.display_names?.[0]),
          filingUrl: fetched.filingUrl,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is InsiderTrade => r !== null);
}
