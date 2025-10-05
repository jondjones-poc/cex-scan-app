import type { AppSettings } from "./settings";

export type ProductCheckResult = {
  productId: string;
  url: string;
  name?: string;
  apiUrl?: string;
  inStock: boolean;
  stockNote?: string;
  httpStatus?: number;
  quantity?: number;
  imageUrl?: string;
  price?: string;
};

function buildProductUrl(baseUrl: string, productId: string): string {
  // Common product URL form on CeX: product page by SKU
  // This may need adjusting based on your actual IDs
  const trimmed = productId.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Use product-detail/?id=SKU which is the current format used on uk.webuy.com (with trailing slash)
  return `${baseUrl.replace(/\/$/, "")}/product-detail/?id=${encodeURIComponent(trimmed)}`;
}

async function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function fetchCexApiBySku(sku: string): Promise<{ status: number; json: any } | null> {
  // Try the working API endpoint first
  const apiUrl = `https://api.webuy.com/api/v2/boxes/${encodeURIComponent(sku)}`;
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
      
      // Log the response for debugging
      console.log(`API response for ${sku} (attempt ${attempt + 1}):`, { status, hasJson: !!json, jsonKeys: json ? Object.keys(json) : [] });
      
      if (json && json.response && json.response.data && json.response.data.boxDetails) {
        return { status, json };
      }
      // Retry on empty/invalid JSON or non-2xx
    } catch (error) {
      console.error(`API attempt ${attempt + 1} failed for ${sku}:`, error);
    }
    await sleep(200 * (attempt + 1));
  }
  return null;
}

async function fetchText(url: string, userAgent: string): Promise<{ status: number; text: string; error?: string }>
{
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": userAgent,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      cache: "no-store"
    });
    
    const text = await res.text();
    
    // Check for error pages
    if (res.status !== 200) {
      return { 
        status: res.status, 
        text, 
        error: `HTTP ${res.status}: ${res.statusText}` 
      };
    }
    
    // Check for "Oh crumbs!" error page
    if (text.toLowerCase().includes("oh crumbs!")) {
      return { 
        status: res.status, 
        text, 
        error: "CeX error page detected: 'Oh crumbs!' - page may be temporarily unavailable" 
      };
    }
    
    return { status: res.status, text };
  } catch (error) {
    return { 
      status: 0, 
      text: "", 
      error: `Network error: ${(error as Error).message}` 
    };
  }
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

export async function checkProducts(
  productIds: string[], 
  settings: AppSettings & { baseUrl: string; userAgent: string },
  onProgress?: (results: ProductCheckResult[]) => void
): Promise<ProductCheckResult[]> {
  const results: ProductCheckResult[] = [];
  
  // Process products in small batches of 2 for better performance while maintaining reliability
  const batchSize = 2;
  const batches = [];
  
  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (productId) => {
      const url = buildProductUrl(settings.baseUrl, productId);
      
      try {
        // Use server-side API to bypass CORS
        const response = await fetch('/api/check-product', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ productId })
        });
        
        const result = await response.json();
        
        if (result.success) {
          return {
            productId: result.productId,
            url: result.url,
            name: result.name,
            apiUrl: result.apiUrl,
            inStock: result.inStock,
            stockNote: result.stockNote,
            httpStatus: result.httpStatus,
            quantity: result.quantity,
            imageUrl: result.imageUrl,
            price: result.price
          };
        } else {
          return {
            productId,
            url,
            name: undefined,
            inStock: false,
            stockNote: result.error || 'Unknown error',
            httpStatus: result.httpStatus || 0
          };
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        let dynamicError = `Error: ${errorMessage}`;
        
        // Provide more specific error messages based on the error type
        if (errorMessage.includes('fetch')) {
          dynamicError = `Network Error: ${errorMessage}`;
        } else if (errorMessage.includes('timeout')) {
          dynamicError = `Timeout Error: ${errorMessage}`;
        } else if (errorMessage.includes('CORS')) {
          dynamicError = `CORS Error: ${errorMessage}`;
        } else if (errorMessage.includes('404')) {
          dynamicError = `Not Found: Product may not exist or URL is incorrect`;
        } else if (errorMessage.includes('403')) {
          dynamicError = `Access Forbidden: ${errorMessage}`;
        } else if (errorMessage.includes('500')) {
          dynamicError = `Server Error: ${errorMessage}`;
        }
        
        return { 
          productId, 
          url, 
          name: undefined,
          inStock: false, 
          stockNote: dynamicError 
        };
      }
    });
    
    // Wait for all products in this batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Call progress callback with current results for real-time updates
    if (onProgress) {
      onProgress([...results]);
    }
    
    // Reduced delay between batches (1 second instead of 2)
    if (batches.indexOf(batch) < batches.length - 1) {
      await sleep(1000);
    }
  }

  return results;
}
