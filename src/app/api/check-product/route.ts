import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
      
      return NextResponse.json({
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
        price: price
      });
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
      price: price
    });

  } catch (error) {
    console.error("Server-side product check error:", error);
    return NextResponse.json({ 
      error: `Server error: ${(error as Error).message}` 
    }, { status: 500 });
  }
}
