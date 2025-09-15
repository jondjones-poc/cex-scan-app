import type { AppSettings } from "./settings";

export type ProductCheckResult = {
  productId: string;
  url: string;
  name?: string;
  apiUrl?: string;
  inStock: boolean;
  stockNote?: string;
  httpStatus?: number;
};

function buildProductUrl(baseUrl: string, productId: string): string {
  // Common product URL form on CeX: product page by SKU
  // This may need adjusting based on your actual IDs
  const trimmed = productId.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Use product-detail?id=SKU which is the current format used on uk.webuy.com
  return `${baseUrl.replace(/\/$/, "")}/product-detail?id=${encodeURIComponent(trimmed)}`;
}

async function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function fetchCexApiBySku(sku: string): Promise<{ status: number; json: any } | null> {
  const apiUrl = `https://wss2.cex.uk.webuy.io/v3/boxes/${encodeURIComponent(sku)}/detail`;
  const headers = {
    "accept": "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
    "accept-language": "en-GB,en;q=0.9"
  } as Record<string, string>;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(apiUrl, { cache: "no-store", headers });
      const status = res.status;
      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (json && json.response) return { status, json };
      // Retry on empty/invalid JSON or non-2xx
    } catch {
      // ignore and retry
    }
    await sleep(200 * (attempt + 1));
  }
  return null;
}

async function fetchText(url: string, userAgent: string): Promise<{ status: number; text: string }>
{
  const res = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    cache: "no-store"
  });
  const text = await res.text();
  return { status: res.status, text };
}

function normalizeHtmlToText(html: string): string {
  // Remove script and style contents
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Strip all tags
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, " ");
  // Decode a few common HTML entities and collapse whitespace
  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return decoded.replace(/\s+/g, " ").trim();
}

function detectStock(html: string): { inStock: boolean; note?: string } {
  const normalized = normalizeHtmlToText(html).toLowerCase();
  // Heuristics: look for phrases often present on CeX product pages
  const indicatorsIn = [
    "in stock",
    "in stock online",
    "collect today",
    "check store stock",
    "available for home delivery",
    "we have",
    "add to basket"
  ];
  const indicatorsOut = [
    "out of stock",
    "not in stock",
    "currently unavailable",
    "we don't have any",
    "notify me",
    "sold out"
  ];

  const hasOut = indicatorsOut.some(s => normalized.includes(s));
  const hasIn = indicatorsIn.some(s => normalized.includes(s));

  if (hasOut && !hasIn) return { inStock: false, note: "Out of stock" };
  if (hasIn && !hasOut) return { inStock: true, note: "In stock" };
  return { inStock: hasIn && !hasOut, note: hasIn ? "Possibly in stock" : "Unknown" };
}

export async function checkProducts(productIds: string[], settings: AppSettings & { baseUrl: string; userAgent: string }): Promise<ProductCheckResult[]> {
  const tasks = productIds.map(async productId => {
    const url = buildProductUrl(settings.baseUrl, productId);
    try {
      // 1) Prefer official API which exposes quantity and out-of-stock flags
      const api = await fetchCexApiBySku(productId);
      if (api && api.json && api.json.response && api.json.response.data && Array.isArray(api.json.response.data.boxDetails)) {
        const box = api.json.response.data.boxDetails[0];
        const qty: number = Number(box?.ecomQuantityOnHand ?? 0);
        const outOfStock: number = Number(box?.outOfStock ?? 0);
        const webSellAllowed: number = Number(box?.webSellAllowed ?? 0);
        // Treat as in stock ONLY when online quantity exists and not flagged out of stock
        const inStock = qty > 0 && outOfStock === 0;
        const note = `qty=${qty}, outOfStock=${outOfStock}, webSellAllowed=${webSellAllowed}, apiStatus=${api.status}`;
        return { productId, url, name: box?.boxName ?? undefined, apiUrl: `https://wss2.cex.uk.webuy.io/v3/boxes/${encodeURIComponent(productId)}/detail`, inStock, stockNote: note, httpStatus: api.status };
      }

      // 2) Fallback to HTML heuristics if API failed or structure unexpected
      const { status, text } = await fetchText(url, settings.userAgent);
      const stock = detectStock(text);
      return { productId, url, inStock: stock.inStock, stockNote: stock.note, httpStatus: status };
    } catch (error) {
      return { productId, url, inStock: false, stockNote: `Error: ${(error as Error).message}` };
    }
  });

  return Promise.all(tasks);
}
