import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Helper function to extract stores from HTML
async function extractStoresFromHTML(html: string, productId: string): Promise<string[]> {
  const stores: string[] = [];
  
  // Method 0: Look for store availability data in JSON/JavaScript - CeX often loads this dynamically
  // Look for patterns like: "storeStock": [...], "storeAvailability": [...], etc.
  const jsonDataPatterns = [
    /"storeStock"\s*:\s*(\[[^\]]+\])/gi,
    /"storeAvailability"\s*:\s*(\[[^\]]+\])/gi,
    /"stores"\s*:\s*(\[[^\]]+\])/gi,
    /"availableStores"\s*:\s*(\[[^\]]+\])/gi,
    /storeStock\s*=\s*(\[[^\]]+\])/gi,
    /storeAvailability\s*=\s*(\[[^\]]+\])/gi,
  ];
  
  for (const pattern of jsonDataPatterns) {
    const matches = Array.from(html.matchAll(pattern));
    for (const match of matches) {
      try {
        const storeData = JSON.parse(match[1]);
        storeData.forEach((item: any) => {
          if (typeof item === 'string') {
            stores.push(item);
          } else if (item && (item.storeName || item.name || item.store || item.location)) {
            stores.push(item.storeName || item.name || item.store || item.location);
          } else if (item && typeof item === 'object') {
            // Check all string values in the object
            Object.values(item).forEach((val: any) => {
              if (typeof val === 'string' && val.length > 2 && val.length < 100) {
                stores.push(val);
              }
            });
          }
        });
      } catch (e) {
        // Not valid JSON, continue
      }
    }
  }
  
  // Method 1: Look for store names in data attributes or specific CeX patterns
  const storeIdPattern = /data-store-id=["']([^"']+)["']/gi;
  const storeIdMatches = Array.from(html.matchAll(storeIdPattern));
  const storeIds = new Set(storeIdMatches.map(m => m[1]));
  
  // Also look for store names directly in data attributes
  const storeNamePattern = /data-store-name=["']([^"']+)["']/gi;
  const storeNameMatches = Array.from(html.matchAll(storeNamePattern));
  storeNameMatches.forEach(m => {
    if (m[1] && m[1].length > 2) {
      stores.push(m[1]);
    }
  });
  
  // Method 2: Look for store names in text content near "available" or "in stock"
  const availableAtPattern = /(?:available|in stock|collect from|pick up from)[^<]*:?\s*([^<]{10,500}?)(?:<|$)/gi;
  const availableMatches = Array.from(html.matchAll(availableAtPattern));
  
  // Also look for "Check store stock" or "Store availability" sections
  const storeStockPattern = /(?:check store|store availability|store stock|available at)[^<]{0,200}([^<]{10,1000}?)(?:<|$)/gi;
  const storeStockMatches = Array.from(html.matchAll(storeStockPattern));
  availableMatches.push(...storeStockMatches);
  
  // Method 3: Look for store names in list items or divs with store-related classes
  const storeListPattern = /<[^>]*(?:class|id)=["'][^"']*(?:store|location|branch)[^"']*["'][^>]*>([^<]+)</gi;
  const storeListMatches = Array.from(html.matchAll(storeListPattern));
  
  // Method 4: Look for store information in script tags (JSON data or JavaScript variables)
  const scriptDataPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scriptMatches = Array.from(html.matchAll(scriptDataPattern));
  
  for (const scriptMatch of scriptMatches) {
    const scriptContent = scriptMatch[1];
    
    // Look for JSON data with store information
    try {
      const jsonMatches = scriptContent.match(/\{[^{}]*"store[^}]*\}/gi);
      if (jsonMatches) {
        for (const jsonStr of jsonMatches) {
          try {
            const json = JSON.parse(jsonStr);
            if (json.storeName || json.store) {
              stores.push(json.storeName || json.store);
            }
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
      
      // Look for arrays of store data
      const storeArrayPatterns = [
        /(?:stores|locations|branches|availableStores)\s*[:=]\s*\[([^\]]+)\]/gi,
        /"stores"\s*:\s*\[([^\]]+)\]/gi,
        /'stores'\s*:\s*\[([^\]]+)\]/gi,
      ];
      
      for (const pattern of storeArrayPatterns) {
        const arrayMatches = Array.from(scriptContent.matchAll(pattern));
        for (const match of arrayMatches) {
          const storeData = match[1];
          try {
            const storeArray = JSON.parse(`[${storeData}]`);
            storeArray.forEach((item: any) => {
              if (typeof item === 'string') {
                stores.push(item);
              } else if (item && (item.name || item.storeName || item.store)) {
                stores.push(item.name || item.storeName || item.store);
              }
            });
          } catch (e) {
            const storeNames = storeData.split(',').map((s: string) => s.trim().replace(/['"]/g, ''));
            storeNames.forEach((name: string) => {
              if (name && name.length > 2 && name.length < 100) {
                stores.push(name);
              }
            });
          }
        }
      }
      
      // Look for window.__INITIAL_STATE__ or similar React/Vue state objects
      const statePattern = /(?:window\.__INITIAL_STATE__|window\.__NEXT_DATA__|__INITIAL_STATE__)\s*=\s*({[\s\S]*?});/i;
      const stateMatch = scriptContent.match(statePattern);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          const findStoresInObject = (obj: any, path: string[] = []): void => {
            if (!obj || typeof obj !== 'object') return;
            for (const [key, value] of Object.entries(obj)) {
              if (key.toLowerCase().includes('store') && Array.isArray(value)) {
                (value as any[]).forEach((item: any) => {
                  if (typeof item === 'string') {
                    stores.push(item);
                  } else if (item && (item.name || item.storeName)) {
                    stores.push(item.name || item.storeName);
                  }
                });
              } else if (typeof value === 'object') {
                findStoresInObject(value, [...path, key]);
              }
            }
          };
          findStoresInObject(state);
        } catch (e) {
          // Not valid JSON
        }
      }
    } catch (e) {
      // Error parsing script, continue
    }
  }
  
  // Extract store names from available matches
  for (const match of availableMatches) {
    const text = match[1].trim();
    const potentialStores = text.split(/[,;|]/).map(s => s.trim());
    potentialStores.forEach(store => {
      if (store && store.length > 2 && store.length < 100 && 
          !store.match(/^\d+$/) &&
          !store.toLowerCase().includes('click') &&
          !store.toLowerCase().includes('here')) {
        stores.push(store);
      }
    });
  }
  
  // Extract from store list matches
  for (const match of storeListMatches) {
    const storeName = match[1].trim();
    if (storeName && storeName.length > 2 && storeName.length < 100) {
      const cleanName = storeName
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanName && !cleanName.match(/^\d+$/) && !stores.includes(cleanName)) {
        stores.push(cleanName);
      }
    }
  }
  
  // Method 5: If we have store IDs, try to map them to store names from settings
  if (storeIds.size > 0) {
    try {
      const settings = await readSettings();
      if (settings.allStores) {
        storeIds.forEach(storeId => {
          const storeEntry = Object.entries(settings.allStores).find(([name, id]) => 
            id === storeId || name.toLowerCase().includes(storeId.toLowerCase())
          );
          if (storeEntry && !stores.includes(storeEntry[0])) {
            stores.push(storeEntry[0]);
          }
        });
      }
    } catch (e) {
      console.error("Error reading settings for store mapping:", e);
    }
  }
  
  // Method 6: Look for store names in any text that looks like a store name
  // Common UK store name patterns: City names, "CeX [Location]", etc.
  // This is a fallback that looks for any capitalized words that might be store names
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ') // Remove styles
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Look for patterns like "Available at: London, Manchester, Birmingham"
  // or "Store: [Name]" or similar
  const storeNamePatterns = [
    /(?:available|in stock|collect|pick up|store)[^:]*:\s*([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z][a-zA-Z\s]+)*)/gi,
    /store[^:]*:\s*([A-Z][a-zA-Z\s,]+)/gi,
    /location[^:]*:\s*([A-Z][a-zA-Z\s,]+)/gi,
  ];
  
  for (const pattern of storeNamePatterns) {
    const matches = Array.from(textContent.matchAll(pattern));
    for (const match of matches) {
      const storeText = match[1];
      const potentialStores = storeText.split(',').map(s => s.trim()).filter(s => s.length > 2);
      potentialStores.forEach(store => {
        // Filter out common false positives
        if (store.length > 2 && store.length < 50 &&
            !store.match(/^(Click|Here|Today|Now|Online|Delivery)$/i) &&
            !store.toLowerCase().includes('click') &&
            !store.toLowerCase().includes('here') &&
            !store.match(/^\d+$/) &&
            !stores.includes(store)) {
          stores.push(store);
        }
      });
    }
  }
  
  // Method 7: Look for store names in list elements (ul, ol, li)
  const listItemPattern = /<li[^>]*>([^<]+)<\/li>/gi;
  const listMatches = Array.from(html.matchAll(listItemPattern));
  for (const match of listMatches) {
    const text = match[1].trim();
    // If it looks like a store name (starts with capital, reasonable length)
    if (text.match(/^[A-Z][a-zA-Z\s-]{2,40}$/) && 
        !text.toLowerCase().includes('click') &&
        !text.toLowerCase().includes('here') &&
        !stores.includes(text)) {
      stores.push(text);
    }
  }
  
  // Method 8: Look for store names in option elements (dropdowns)
  const optionPattern = /<option[^>]*value=["']([^"']+)["'][^>]*>([^<]+)<\/option>/gi;
  const optionMatches = Array.from(html.matchAll(optionPattern));
  for (const match of optionMatches) {
    const optionText = match[2].trim();
    if (optionText.length > 2 && optionText.length < 50 &&
        optionText.match(/^[A-Z]/) &&
        !optionText.toLowerCase().includes('select') &&
        !optionText.toLowerCase().includes('choose') &&
        !stores.includes(optionText)) {
      stores.push(optionText);
    }
  }
  
  // Remove duplicates and sort alphabetically
  return [...new Set(stores)].sort((a, b) => a.localeCompare(b));
}

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();
    
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    console.log(`Server-side checking product: ${productId}`);

    // Try the JSON API first - but handle redirects to wss2.cex.uk.webuy.io
    const apiUrls = [
      `https://api.webuy.com/api/v2/boxes/${encodeURIComponent(productId)}`,
      `https://wss2.cex.uk.webuy.io/v3/boxes/${encodeURIComponent(productId.toLowerCase())}/detail`
    ];
    
    const headers = {
      "accept": "application/json, text/plain, */*",
      "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
      "accept-language": "en-GB,en;q=0.9",
      "referer": "https://uk.webuy.com/"
    };

    let apiResult = null;
    for (const apiUrl of apiUrls) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`Trying API URL: ${apiUrl} (attempt ${attempt + 1})`);
          const res = await fetch(apiUrl, { 
            cache: "no-store", 
            headers,
            redirect: "follow" // Follow redirects
          });
          const status = res.status;
          let json: any = null;
          try {
            json = await res.json();
          } catch {}
          
          console.log(`API response for ${productId}:`, { 
            url: apiUrl, 
            status, 
            finalUrl: res.url,
            hasJson: !!json, 
            jsonKeys: json ? Object.keys(json) : [] 
          });
          
          if (json && json.response && json.response.data && json.response.data.boxDetails) {
            apiResult = { status, json };
            break;
          }
        } catch (error) {
          console.error(`API attempt failed for ${apiUrl}:`, error);
        }
        // Reduced retry delay from 200ms to 100ms
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
      if (apiResult) break;
    }

    if (apiResult && apiResult.json && apiResult.json.response && apiResult.json.response.data && Array.isArray(apiResult.json.response.data.boxDetails)) {
      const box = apiResult.json.response.data.boxDetails[0];
      const qty: number = Number(box?.ecomQuantityOnHand ?? 0);
      const outOfStock: number = Number(box?.outOfStock ?? 0);
      const webSellAllowed: number = Number(box?.webSellAllowed ?? 0);
      const inStock = qty > 0 && outOfStock === 0;
      const note = `qty=${qty}, outOfStock=${outOfStock}, webSellAllowed=${webSellAllowed}, apiStatus=${apiResult.status}`;
      
      const productName = box?.boxName || box?.name || box?.title || box?.productName;
      
      // Extract image URL from API response
      let imageUrl = undefined;
      if (box?.imageUrls) {
        // CEX API provides imageUrls object with large, medium, small
        imageUrl = box.imageUrls.large || box.imageUrls.medium || box.imageUrls.small;
      } else if (box?.imageUrl) {
        imageUrl = box.imageUrl;
      } else if (box?.images && Array.isArray(box.images) && box.images.length > 0) {
        imageUrl = box.images[0];
      } else if (box?.thumbnail) {
        imageUrl = box.thumbnail;
      }

      // Extract price from API response - try various possible price fields
      let price = undefined;
      const possiblePriceFields = [
        box?.sellPrice,        // Main selling price
        box?.cashPrice,        // Cash price
        box?.exchangePrice,    // Exchange price
        box?.firstPrice,       // First price
        box?.previousPrice,    // Previous price
        box?.sellingPrice,
        box?.price,
        box?.cost,
        box?.amount,
        box?.value,
        box?.ecomSellingPrice,
        box?.webPrice,
        box?.onlinePrice
      ];

      for (const priceField of possiblePriceFields) {
        if (priceField !== undefined && priceField !== null && priceField > 0) {
          // Convert to string and format as currency
          const priceStr = priceField.toString();
          const priceMatch = priceStr.match(/([0-9]+\.?[0-9]*)/);
          if (priceMatch) {
            price = `£${priceMatch[1]}`;
            console.log(`Found price in API for ${productId}: ${price} (from field: ${Object.keys(box || {}).find(key => box?.[key] === priceField) || 'unknown'})`);
            break;
          }
        }
      }

      if (!price) {
        console.log(`No price found in API response for ${productId}. Available fields:`, Object.keys(box || {}).filter(key => 
          typeof box?.[key] === 'number' && key.toLowerCase().includes('price')
        ));
      }

      // Try to extract store availability from API response
      let stores: string[] = [];
      if (inStock && box) {
        // Check if API response contains store information
        // Common fields that might contain store data
        if (box.storeLocations && Array.isArray(box.storeLocations)) {
          stores = box.storeLocations.map((loc: any) => loc.storeName || loc.name || loc).filter(Boolean);
        } else if (box.stores && Array.isArray(box.stores)) {
          stores = box.stores.map((store: any) => store.name || store.storeName || store).filter(Boolean);
        } else if (box.availableStores && Array.isArray(box.availableStores)) {
          stores = box.availableStores.map((store: any) => store.name || store.storeName || store).filter(Boolean);
        } else if (box.storeStock && Array.isArray(box.storeStock)) {
          stores = box.storeStock.map((stock: any) => stock.storeName || stock.store || stock.name || stock).filter(Boolean);
        } else if (box.locations && Array.isArray(box.locations)) {
          stores = box.locations.map((loc: any) => loc.storeName || loc.name || loc.store || loc).filter(Boolean);
        }
        
        // Log available fields for debugging if no stores found
        if (stores.length === 0) {
          const storeRelatedFields = Object.keys(box || {}).filter(key => 
            key.toLowerCase().includes('store') || 
            key.toLowerCase().includes('location') ||
            key.toLowerCase().includes('available')
          );
          if (storeRelatedFields.length > 0) {
            console.log(`Store-related fields found for ${productId}:`, storeRelatedFields);
            // Log the actual values of store-related fields
            storeRelatedFields.forEach(field => {
              console.log(`  ${field}:`, box[field]);
            });
          } else {
            // Log all top-level keys to help identify potential store fields
            console.log(`All API response fields for ${productId}:`, Object.keys(box || {}).slice(0, 20));
          }
        }
      }
      
      // If no stores found in API response, try to get them from HTML page
      let htmlForDebug = '';
      if (stores.length === 0 && inStock) {
        console.log(`No stores in API response for ${productId} (qty: ${qty}), checking HTML page...`);
        try {
          const productUrl = `https://uk.webuy.com/product-detail/?id=${encodeURIComponent(productId)}`;
          const htmlResponse = await fetch(productUrl, {
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
              "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "referer": "https://uk.webuy.com/"
            },
            cache: "no-store",
            redirect: "follow"
          });
          
          if (htmlResponse.ok) {
            htmlForDebug = await htmlResponse.text();
            
            // Try to find store availability API call in the HTML (CeX might load this via JavaScript)
            // Look for API endpoints that might contain store data
            const apiPatterns = [
              /(?:api|endpoint|url)[^"']*store[^"']*["']([^"']+)["']/gi,
              /fetch\(["']([^"']*store[^"']*)["']/gi,
              /axios\.(?:get|post)\(["']([^"']*store[^"']*)["']/gi,
            ];
            
            for (const pattern of apiPatterns) {
              const matches = Array.from(htmlForDebug.matchAll(pattern));
              if (matches.length > 0) {
                console.log(`Found potential store API endpoints in HTML for ${productId}:`, matches.slice(0, 3).map(m => m[1]));
              }
            }
            
            // Log HTML snippets that might contain store info
            const storeSnippets = htmlForDebug.match(/.{0,500}(?:store|location|branch|available).{0,500}/gi);
            if (storeSnippets && storeSnippets.length > 0) {
              console.log(`Found ${storeSnippets.length} HTML snippets with store keywords (first 3):`, storeSnippets.slice(0, 3));
            }
            
            // Log HTML structure for debugging
            console.log(`[HTML Debug] Checking HTML for ${productId}, length: ${htmlForDebug.length}`);
            
            // Look for the store availability API endpoint that's called when "All Stores" is clicked
            // This is usually an API call like /api/store-stock or similar
            const apiEndpointPatterns = [
              /(?:fetch|axios|ajax|\.get|\.post)\(["']([^"']*(?:store|stock|availability|location)[^"']*)["']/gi,
              /url\s*[:=]\s*["']([^"']*(?:store|stock|availability)[^"']*)["']/gi,
              /endpoint\s*[:=]\s*["']([^"']*(?:store|stock)[^"']*)["']/gi,
              /["']([^"']*\/api\/[^"']*store[^"']*)["']/gi,
              /["']([^"']*\/api\/[^"']*stock[^"']*)["']/gi,
              /["']([^"']*\/api\/[^"']*availability[^"']*)["']/gi,
            ];
            
            const foundEndpoints: string[] = [];
            for (const pattern of apiEndpointPatterns) {
              const matches = Array.from(htmlForDebug.matchAll(pattern));
              matches.forEach(match => {
                const endpoint = match[1];
                if (endpoint && !endpoint.startsWith('http') && endpoint.includes('/')) {
                  foundEndpoints.push(endpoint);
                } else if (endpoint && endpoint.startsWith('http')) {
                  foundEndpoints.push(endpoint);
                }
              });
            }
            
            // Also look for API calls with product ID
            const productApiPattern = new RegExp(`["']([^"']*api[^"']*${productId}[^"']*)["']`, 'gi');
            const productApiMatches = Array.from(htmlForDebug.matchAll(productApiPattern));
            productApiMatches.forEach(match => {
              if (match[1] && !foundEndpoints.includes(match[1])) {
                foundEndpoints.push(match[1]);
              }
            });
            
            console.log(`[API Debug] Found ${foundEndpoints.length} potential API endpoints:`, foundEndpoints.slice(0, 10));
            
            // Also try common CeX API endpoints for store stock
            const commonEndpoints = [
              `/api/v2/boxes/${productId}/store-stock`,
              `/api/v2/boxes/${productId}/stores`,
              `/api/v2/store-stock/${productId}`,
              `/api/store-stock?boxId=${productId}`,
              `/api/stores?productId=${productId}`,
              `/api/v3/boxes/${productId}/store-availability`,
              `https://wss2.cex.uk.webuy.io/v3/boxes/${productId}/store-stock`,
              `https://wss2.cex.uk.webuy.io/v3/boxes/${productId}/stores`,
              `https://api.webuy.com/api/v2/boxes/${productId}/store-stock`,
              `https://api.webuy.com/api/v2/store-stock/${productId}`,
            ];
            
            // Try common endpoints first
            for (const endpoint of commonEndpoints) {
              try {
                let apiUrl = endpoint;
                // Make relative URLs absolute
                if (apiUrl.startsWith('/')) {
                  apiUrl = `https://uk.webuy.com${apiUrl}`;
                } else if (!apiUrl.startsWith('http')) {
                  apiUrl = `https://uk.webuy.com/${apiUrl}`;
                }
                
                console.log(`[API Debug] Trying endpoint: ${apiUrl}`);
                const apiResponse = await fetch(apiUrl, {
                  headers: {
                    "accept": "application/json",
                    "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)",
                    "referer": `https://uk.webuy.com/product-detail/?id=${productId}`,
                    "accept-language": "en-GB,en;q=0.9"
                  },
                  cache: "no-store"
                });
                
                console.log(`[API Debug] Endpoint ${apiUrl} returned status: ${apiResponse.status}`);
                
                if (apiResponse.ok) {
                  const apiData = await apiResponse.json();
                  console.log(`[API Debug] Common endpoint ${endpoint} returned:`, JSON.stringify(apiData).substring(0, 1000));
                  
                  // Extract stores from response
                  const extractStoresFromApiData = (data: any): string[] => {
                    const found: string[] = [];
                    if (Array.isArray(data)) {
                      data.forEach((item: any) => {
                        if (typeof item === 'string') {
                          found.push(item);
                        } else if (item && typeof item === 'object') {
                          if (item.storeName || item.name || item.store || item.location) {
                            found.push(item.storeName || item.name || item.store || item.location);
                          } else if (item.quantity && item.quantity > 0) {
                            // If it has quantity > 0, it's a store with stock
                            if (item.storeName || item.name || item.store) {
                              found.push(item.storeName || item.name || item.store);
                            }
                          }
                        }
                      });
                    } else if (data && typeof data === 'object') {
                      // Recursively search for store data
                      const search = (obj: any): void => {
                        if (!obj || typeof obj !== 'object') return;
                        for (const [key, value] of Object.entries(obj)) {
                          if (key.toLowerCase().includes('store') && Array.isArray(value)) {
                            (value as any[]).forEach((item: any) => {
                              if (typeof item === 'string') {
                                found.push(item);
                              } else if (item && (item.storeName || item.name || item.store)) {
                                found.push(item.storeName || item.name || item.store);
                              } else if (item && item.quantity && item.quantity > 0) {
                                // Store with stock
                                if (item.storeName || item.name || item.store) {
                                  found.push(item.storeName || item.name || item.store);
                                }
                              }
                            });
                          } else if (typeof value === 'object') {
                            search(value);
                          }
                        }
                      };
                      search(data);
                    }
                    return found;
                  };
                  
                  const apiStores = extractStoresFromApiData(apiData);
                  if (apiStores.length > 0) {
                    stores.push(...apiStores);
                    console.log(`✅ Found ${apiStores.length} stores from common API ${endpoint}:`, apiStores);
                    break; // Found stores, no need to check other endpoints
                  } else {
                    console.log(`[API Debug] Endpoint ${endpoint} returned data but no stores extracted. Response keys:`, typeof apiData === 'object' && apiData ? Object.keys(apiData) : 'N/A');
                    console.log(`[API Debug] Full response sample:`, JSON.stringify(apiData).substring(0, 2000));
                  }
                } else {
                  const errorText = await apiResponse.text().catch(() => '');
                  console.log(`[API Debug] Endpoint ${endpoint} returned status ${apiResponse.status}. Response:`, errorText.substring(0, 500));
                }
              } catch (e) {
                console.log(`[API Debug] Error calling endpoint ${endpoint}:`, (e as Error).message);
                // Continue to next endpoint
              }
            }
            
            // Try calling the store availability API endpoints found in HTML
            for (const endpoint of foundEndpoints.slice(0, 5)) { // Limit to first 5 to avoid too many requests
              try {
                let apiUrl = endpoint;
                // Make relative URLs absolute
                if (apiUrl.startsWith('/')) {
                  apiUrl = `https://uk.webuy.com${apiUrl}`;
                } else if (!apiUrl.startsWith('http')) {
                  apiUrl = `https://uk.webuy.com/${apiUrl}`;
                }
                
                // Try GET request first
                const apiResponse = await fetch(apiUrl, {
                  headers: {
                    "accept": "application/json",
                    "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)",
                    "referer": `https://uk.webuy.com/product-detail/?id=${productId}`
                  },
                  cache: "no-store"
                });
                
                if (apiResponse.ok) {
                  const apiData = await apiResponse.json();
                  console.log(`[API Debug] Successfully called ${apiUrl}, response:`, JSON.stringify(apiData).substring(0, 500));
                  
                  // Try to extract stores from the API response
                  const extractStoresFromApiData = (data: any): string[] => {
                    const found: string[] = [];
                    if (Array.isArray(data)) {
                      data.forEach((item: any) => {
                        if (typeof item === 'string') {
                          found.push(item);
                        } else if (item && typeof item === 'object') {
                          if (item.storeName || item.name || item.store || item.location) {
                            found.push(item.storeName || item.name || item.store || item.location);
                          }
                        }
                      });
                    } else if (data && typeof data === 'object') {
                      // Recursively search for store data
                      const search = (obj: any): void => {
                        if (!obj || typeof obj !== 'object') return;
                        for (const [key, value] of Object.entries(obj)) {
                          if (key.toLowerCase().includes('store') && Array.isArray(value)) {
                            (value as any[]).forEach((item: any) => {
                              if (typeof item === 'string') {
                                found.push(item);
                              } else if (item && (item.storeName || item.name || item.store)) {
                                found.push(item.storeName || item.name || item.store);
                              }
                            });
                          } else if (typeof value === 'object') {
                            search(value);
                          }
                        }
                      };
                      search(data);
                    }
                    return found;
                  };
                  
                  const apiStores = extractStoresFromApiData(apiData);
                  if (apiStores.length > 0) {
                    stores.push(...apiStores);
                    console.log(`✅ Found ${apiStores.length} stores from API ${apiUrl}:`, apiStores);
                    break; // Found stores, no need to check other endpoints
                  }
                }
              } catch (e) {
                // Try POST request with product ID
                try {
                  let apiUrl = endpoint;
                  if (apiUrl.startsWith('/')) {
                    apiUrl = `https://uk.webuy.com${apiUrl}`;
                  } else if (!apiUrl.startsWith('http')) {
                    apiUrl = `https://uk.webuy.com/${apiUrl}`;
                  }
                  
                  const postResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                      "accept": "application/json",
                      "content-type": "application/json",
                      "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)",
                      "referer": `https://uk.webuy.com/product-detail/?id=${productId}`
                    },
                    body: JSON.stringify({ productId, boxId: productId, id: productId }),
                    cache: "no-store"
                  });
                  
                  if (postResponse.ok) {
                    const apiData = await postResponse.json();
                    // Extract stores from response (same logic as above)
                    // ... (would use same extraction logic)
                  }
                } catch (e2) {
                  // Ignore
                }
              }
            }
            
            // If API calls didn't work, try HTML parsing
            if (stores.length === 0) {
              stores = await extractStoresFromHTML(htmlForDebug, productId);
            }
            if (stores.length > 0) {
              console.log(`✅ Found ${stores.length} stores in HTML for ${productId}:`, stores);
            } else {
              console.log(`❌ No stores found in HTML for ${productId}. HTML length: ${htmlForDebug.length}`);
              // Log what we found for debugging
              const storeKeywordMatches = htmlForDebug.match(/.{0,200}(?:store|location|branch).{0,200}/gi);
              if (storeKeywordMatches && storeKeywordMatches.length > 0) {
                console.log(`Found ${storeKeywordMatches.length} HTML snippets with store keywords (first 10):`, storeKeywordMatches.slice(0, 10));
              }
              
              // Try to find any text that looks like store names (capitalized words, city names, etc.)
              const capitalizedWords = htmlForDebug.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
              if (capitalizedWords) {
                const potentialStoreNames = [...new Set(capitalizedWords)]
                  .filter(word => word.length > 3 && word.length < 30)
                  .filter(word => !word.match(/^(The|This|That|Click|Here|Today|Now|Online|Delivery|Product|Item|Price|Stock|Quantity)$/i))
                  .slice(0, 20);
                console.log(`[HTML Debug] Potential store names found (first 20):`, potentialStoreNames);
              }
              
              // Try checking stores via search API as a fallback (limited to first 10 stores for performance)
              if (qty > 0 && qty <= 20) {
                console.log(`Attempting to check stores via search API for ${productId} (qty: ${qty})...`);
                try {
                  const settings = await readSettings();
                  if (settings.allStores && Object.keys(settings.allStores).length > 0) {
                    // Only check a limited number of stores to avoid being too slow
                    const storeNames = Object.keys(settings.allStores).slice(0, Math.min(20, qty * 2));
                    const storeChecks = await Promise.allSettled(
                      storeNames.map(async (storeName) => {
                        try {
                          const storeId = settings.allStores[storeName];
                          // Search for the product in this store
                          const searchUrl = `https://uk.webuy.com/search?q=${encodeURIComponent(productId)}&stores=${encodeURIComponent(storeId)}`;
                          const searchResponse = await fetch(searchUrl, {
                            headers: { "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)" },
                            cache: "no-store"
                          });
                          
                          if (searchResponse.ok) {
                            const searchHtml = await searchResponse.text();
                            // Check if product ID appears in search results
                            if (searchHtml.includes(productId) || searchHtml.toLowerCase().includes(productName?.toLowerCase().substring(0, 20) || '')) {
                              return storeName;
                            }
                          }
                          return null;
                        } catch (e) {
                          return null;
                        }
                      })
                    );
                    
                    const foundStores = storeChecks
                      .filter((result): result is PromiseFulfilledResult<string> => 
                        result.status === 'fulfilled' && result.value !== null
                      )
                      .map(result => result.value);
                    
                    if (foundStores.length > 0) {
                      stores = foundStores;
                      console.log(`✅ Found ${stores.length} stores via search API for ${productId}:`, stores);
                    }
                  }
                } catch (e) {
                  console.error(`Error checking stores via search API for ${productId}:`, e);
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error fetching HTML for store info for ${productId}:`, e);
        }
      }
      
      // Log the full API response structure for debugging
      if (stores.length === 0 && inStock) {
        console.log(`=== API Response Structure for ${productId} ===`);
        console.log('Box keys:', Object.keys(box || {}));
        console.log('Full box object:', JSON.stringify(box, null, 2));
        console.log('Quantity:', qty, 'OutOfStock:', outOfStock);
        
        // Check for any array fields that might contain store data
        Object.keys(box || {}).forEach(key => {
          const value = box[key];
          if (Array.isArray(value) && value.length > 0) {
            console.log(`Array field "${key}" (${value.length} items):`, JSON.stringify(value.slice(0, 3), null, 2));
          } else if (typeof value === 'object' && value !== null) {
            const objKeys = Object.keys(value);
            if (objKeys.some(k => k.toLowerCase().includes('store') || k.toLowerCase().includes('location'))) {
              console.log(`Object field "${key}" with store-related keys:`, objKeys);
            }
          }
        });
      }
      
      const responseData = {
        success: true,
        productId,
        name: productName,
        inStock,
        stockNote: note,
        httpStatus: apiResult.status,
        apiUrl: `https://api.webuy.com/api/v2/boxes/${encodeURIComponent(productId)}`,
        url: `https://uk.webuy.com/product-detail/?id=${encodeURIComponent(productId)}`,
        quantity: qty,
        imageUrl: imageUrl,
        price: price,
        stores: stores.length > 0 ? stores : undefined,
        // Include debug info for client-side inspection
        _debug: stores.length === 0 && inStock ? {
          apiBoxKeys: Object.keys(box || {}),
          apiBoxSample: box ? JSON.stringify(box).substring(0, 5000) : null,
          checkedHtml: htmlForDebug.length > 0,
          htmlLength: htmlForDebug.length,
          htmlSample: htmlForDebug ? htmlForDebug.substring(0, 10000) : null
        } : undefined
      };
      
      return NextResponse.json(responseData);
    }

    // Fallback to HTML scraping
    const productUrl = `https://uk.webuy.com/product-detail/?id=${encodeURIComponent(productId)}`;
    console.log(`Falling back to HTML scraping for: ${productUrl}`);

    // Reduced delay for async redirects
    await new Promise(r => setTimeout(r, 500));

    const response = await fetch(productUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "referer": "https://uk.webuy.com/"
      },
      cache: "no-store",
      redirect: "follow"
    });

    const html = await response.text();
    
    if (response.status !== 200) {
      return NextResponse.json({ 
        error: `HTTP ${response.status}: ${response.statusText}`,
        productId,
        url: productUrl,
        httpStatus: response.status
      }, { status: response.status });
    }
    
    if (html.toLowerCase().includes("oh crumbs!")) {
      return NextResponse.json({ 
        error: "CeX error page detected: 'Oh crumbs!' - page may be temporarily unavailable",
        productId,
        url: productUrl,
        httpStatus: response.status
      }, { status: 400 });
    }

    // Extract H1 content (page title) - improved regex to handle nested tags
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    let pageTitle = "No title found";
    
    if (h1Match) {
      // Remove any HTML tags within the H1 and clean up the text
      pageTitle = h1Match[1]
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&amp;/g, '&') // Replace &amp; with &
        .replace(/&lt;/g, '<') // Replace &lt; with <
        .replace(/&gt;/g, '>') // Replace &gt; with >
        .replace(/&quot;/g, '"') // Replace &quot; with "
        .replace(/&#x27;|&apos;/g, "'") // Replace &#x27; or &apos; with '
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
    }
    
    console.log(`Page title for ${productId}: ${pageTitle}`);

    // Simple stock detection from HTML
    const normalized = html.toLowerCase();
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

    let inStock = false;
    let note = "Unknown";
    
    if (hasOut && !hasIn) {
      inStock = false;
      note = "Out of stock";
    } else if (hasIn && !hasOut) {
      inStock = true;
      note = "In stock";
    } else {
      inStock = hasIn && !hasOut;
      note = hasIn ? "Possibly in stock" : "Unknown";
    }

    // Extract image URL from HTML
    let imageUrl = undefined;
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch && imgMatch[1]) {
      imageUrl = imgMatch[1];
      // Convert relative URLs to absolute
      if (imageUrl.startsWith('/')) {
        imageUrl = 'https://uk.webuy.com' + imageUrl;
      }
    }

    // Extract price from HTML - look for various price patterns
    let price = undefined;
    const pricePatterns = [
      /£([0-9]+\.?[0-9]*)/,  // £42.00 or £42
      /price[^>]*>([^<]*£[0-9]+\.?[0-9]*[^<]*)</i,  // price>£42.00<
      /cost[^>]*>([^<]*£[0-9]+\.?[0-9]*[^<]*)</i,   // cost>£42.00<
      /amount[^>]*>([^<]*£[0-9]+\.?[0-9]*[^<]*)</i, // amount>£42.00<
      /<span[^>]*class[^>]*price[^>]*>([^<]*£[0-9]+\.?[0-9]*[^<]*)</i, // <span class="price">£42.00</span>
      /<div[^>]*class[^>]*price[^>]*>([^<]*£[0-9]+\.?[0-9]*[^<]*)</i   // <div class="price">£42.00</div>
    ];

    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        // Extract the price value and format it
        const priceText = match[1] || match[0];
        const priceMatch = priceText.match(/£([0-9]+\.?[0-9]*)/);
        if (priceMatch) {
          price = `£${priceMatch[1]}`;
          console.log(`Found price for ${productId}: ${price}`);
          break;
        }
      }
    }

    if (!price) {
      console.log(`No price found for ${productId} in HTML`);
    }

    // Try to extract store information from HTML if in stock
    let stores: string[] = [];
    if (inStock) {
      stores = await extractStoresFromHTML(html, productId);
      if (stores.length > 0) {
        console.log(`✅ Found ${stores.length} stores in HTML fallback for ${productId}:`, stores);
      } else {
        console.log(`❌ No stores found in HTML fallback for ${productId}`);
      }
    }

    return NextResponse.json({
      success: true,
      productId,
      name: pageTitle, // Use H1 content as product name
      inStock,
      stockNote: note,
      httpStatus: response.status,
      url: productUrl,
      quantity: inStock ? 1 : 0, // Default quantity for HTML fallback
      imageUrl: imageUrl,
      price: price,
      stores: stores.length > 0 ? stores : undefined
    });

  } catch (error) {
    console.error("Server-side product check error:", error);
    return NextResponse.json({ 
      error: `Server error: ${(error as Error).message}` 
    }, { status: 500 });
  }
}
