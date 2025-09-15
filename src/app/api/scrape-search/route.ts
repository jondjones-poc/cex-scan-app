import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper function to validate if a string looks like a product name
function isValidProductName(text: string, showAllProducts: boolean = false): boolean {
  // If showAllProducts is true, be more lenient
  if (showAllProducts) {
    // Only reject obvious non-product text
    if (text.includes('<') || text.includes('>') || text.includes('&lt;') || text.includes('&gt;')) {
      return false;
    }
    
    // Reject if it's too short or too long
    if (text.length < 3 || text.length > 300) {
      return false;
    }
    
    // Reject if it's mostly numbers or special characters
    const alphaCount = (text.match(/[A-Za-z]/g) || []).length;
    if (alphaCount < text.length * 0.3) {
      return false;
    }
    
    return true;
  }
  
  // Original strict validation for manual-only mode
  // Reject if it contains CSS class indicators
  if (text.includes('.') && text.includes('-')) {
    return false;
  }
  
  // Reject if it's mostly CSS class names
  if (text.split(' ').some(word => word.includes('.') || word.includes('-') && word.length < 4)) {
    return false;
  }
  
  // Reject if it contains HTML-like content
  if (text.includes('<') || text.includes('>') || text.includes('&lt;') || text.includes('&gt;')) {
    return false;
  }
  
  // Reject if it's too short or too long
  if (text.length < 5 || text.length > 200) {
    return false;
  }
  
  // Reject if it's mostly numbers or special characters
  const alphaCount = (text.match(/[A-Za-z]/g) || []).length;
  if (alphaCount < text.length * 0.5) {
    return false;
  }
  
  // Reject common non-product text
  const rejectPatterns = [
    /^[A-Za-z\-\.\s]+$/, // Only letters, hyphens, dots, spaces (likely CSS)
    /^(find|search|store|field|border|radius|autocomplete|button|input|form|div|span|class|id)/i,
    /^(x-|cex-|uk-|web-)/i, // CSS prefixes
    /^(\.|#)/, // CSS selectors
    /^[A-Z]{2,}$/, // All caps (likely CSS)
    /^[a-z\-]+$/, // All lowercase with hyphens (likely CSS)
    // Reject common CeX UI elements
    /^(filter|sort|view|show|hide|load|more|next|prev|page|result|found)/i,
    /^(price|condition|console|platform|category|brand)/i,
    /^(add|remove|select|choose|pick|buy|sell|trade)/i,
    // Reject navigation elements
    /^(home|back|forward|up|down|left|right|top|bottom)/i,
    /^(menu|nav|header|footer|sidebar|main|content)/i
  ];
  
  for (const pattern of rejectPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }
  
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { url, showAllProducts = false } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Server-side scraping URL: ${url}`);

    // Make the request server-side to bypass CORS
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1"
      },
      redirect: "follow",
      method: "GET"
    });

    console.log(`Server response status: ${response.status}`);
    console.log(`Server response URL: ${response.url}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error response body:`, errorText.substring(0, 1000));
      return NextResponse.json({ 
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText.substring(0, 1000)
      }, { status: response.status });
    }

    const html = await response.text();
    console.log(`Server received HTML length: ${html.length}`);
    
    // Debug: Log a sample of the HTML to see the structure
    console.log("HTML sample (first 2000 chars):", html.substring(0, 2000));
    console.log("HTML sample (last 2000 chars):", html.substring(Math.max(0, html.length - 2000)));
    
    // Check if this is a Nuxt.js app and look for the actual API endpoint
    // Nuxt.js apps often load data via API calls after the initial page load
    const nuxtDataMatch = html.match(/<script[^>]*>([^<]*window\.__NUXT__[^<]*)<\/script>/);
    if (nuxtDataMatch) {
      console.log("Found Nuxt data:", nuxtDataMatch[1].substring(0, 500));
    }
    
    // Look for any script tags that might contain product data
    const scriptTags = html.match(/<script[^>]*>([^<]*)<\/script>/g);
    if (scriptTags) {
      console.log(`Found ${scriptTags.length} script tags`);
      for (const script of scriptTags.slice(0, 5)) {
        if (script.includes('product') || script.includes('data') || script.includes('api')) {
          console.log("Relevant script tag:", script.substring(0, 200));
        }
      }
    }
    
    // Check if this is a Nuxt.js app and look for JSON payload
    const payloadMatch = html.match(/href="([^"]*_payload\.json[^"]*)"/);
    let payloadData = null;
    if (payloadMatch) {
      const payloadUrl = payloadMatch[1];
      console.log("Found Nuxt payload:", payloadUrl);
      
      try {
        // Make sure it's a full URL
        const fullPayloadUrl = payloadUrl.startsWith('http') ? payloadUrl : new URL(payloadUrl, url).toString();
        console.log("Fetching payload from:", fullPayloadUrl);
        
        const payloadResponse = await fetch(fullPayloadUrl, {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
            "accept": "application/json",
            "cache-control": "no-cache"
          }
        });
        
        if (payloadResponse.ok) {
          payloadData = await payloadResponse.json();
          console.log("Payload data received:", Object.keys(payloadData));
        }
      } catch (error) {
        console.log("Failed to fetch payload:", error);
      }
    }

    // Check for error pages
    if (response.url.includes('/error')) {
      return NextResponse.json({ 
        error: `Redirected to CeX error page: ${response.url}`,
        status: response.status,
        url: response.url
      }, { status: 400 });
    }

    if (html.toLowerCase().includes("oh crumbs!")) {
      return NextResponse.json({ 
        error: "CeX error page detected: 'Oh crumbs!' - page may be temporarily unavailable",
        status: response.status,
        url: response.url
      }, { status: 400 });
    }

    if (html.toLowerCase().includes("page not found") || html.toLowerCase().includes("404")) {
      return NextResponse.json({ 
        error: "Page not found error detected in response",
        status: response.status,
        url: response.url
      }, { status: 404 });
    }

    // Extract product information from CeX search results
    const products: Array<{
      name: string;
      price?: string;
      url?: string;
      imageUrl?: string;
      hasManual?: boolean;
    }> = [];

    // Look for product cards in CeX PLP (Product Listing Page) structure
    // CeX uses a grid layout with product cards containing: name, price, console, condition
    const productCardPatterns = [
      // Look for divs that contain both product links and prices (most reliable)
      /<div[^>]*>([\s\S]*?<a[^>]*href="[^"]*product-detail[^"]*"[^>]*>[\s\S]*?<\/a>[\s\S]*?£[\s\S]*?)<\/div>/gi,
      // Look for product cards with specific CeX classes
      /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<article[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Look for any div that might contain product info
      /<div[^>]*data-[^>]*>([\s\S]*?)<\/div>/gi,
      // More specific CeX patterns
      /<div[^>]*class="[^"]*search-result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    let totalCards = 0;
    let processedCards = 0;

    // Try to find the actual API endpoint that CeX uses
    const possibleApiEndpoints = [
      '/api/products',
      '/api/search',
      '/api/items',
      '/api/games',
      '/api/products/search',
      '/api/items/search',
      // Try CeX-specific endpoints
      '/search/api',
      '/api/v1/products',
      '/api/v1/search',
      '/api/v1/items',
      // Try with query parameters
      '/api/search?categoryIds=1052&sortBy=prod_cex_uk_price_desc&stores=Boscombe~Bournemouth~Bournemouth+-+Castlepoint~Poole',
      // Try GraphQL endpoint
      '/graphql',
      // Try different API versions
      '/api/v2/products',
      '/api/v2/search',
      '/api/v2/items'
    ];
    
    for (const endpoint of possibleApiEndpoints) {
      try {
        const apiUrl = new URL(endpoint, url).toString();
        console.log(`Trying API endpoint: ${apiUrl}`);
        
        const apiResponse = await fetch(apiUrl, {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
            "accept": "application/json",
            "cache-control": "no-cache"
          }
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          console.log(`API endpoint ${endpoint} returned data:`, Object.keys(apiData));
          
          // Try to extract products from API response
          if (Array.isArray(apiData)) {
            apiData.forEach((item: any) => {
              if (item.name || item.title || item.productName) {
                const productName = item.name || item.title || item.productName;
                const price = item.price || item.cost || item.amount;
                const productUrl = item.url || item.link || item.href;
                
                if (productName && typeof productName === 'string' && productName.length > 3) {
                  const hasManual = productName.toLowerCase().includes('manual') || 
                                   productName.toLowerCase().includes('boxed') ||
                                   productName.toLowerCase().includes('complete') ||
                                   productName.toLowerCase().includes('w/ manual') ||
                                   productName.toLowerCase().includes('with manual');
                  
                  if (showAllProducts || hasManual) {
                    console.log(`API found product: "${productName}" - Price: ${price} - Manual: ${hasManual}`);
                    products.push({
                      name: productName,
                      price: price ? `£${price}` : undefined,
                      url: productUrl,
                      imageUrl: item.image || item.imageUrl || item.thumbnail,
                      hasManual: hasManual
                    });
                  }
                }
              }
            });
          }
        }
      } catch (error) {
        console.log(`API endpoint ${endpoint} failed:`, error);
      }
    }

    // First, try to extract products from payload data if available
    if (payloadData) {
      console.log("Extracting products from payload data...");
      
      // Look for products in the payload data structure
      const extractProductsFromPayload = (data: any, path: string = ""): void => {
        if (typeof data === 'object' && data !== null) {
          if (Array.isArray(data)) {
            data.forEach((item, index) => {
              extractProductsFromPayload(item, `${path}[${index}]`);
            });
          } else {
            Object.keys(data).forEach(key => {
              const newPath = path ? `${path}.${key}` : key;
              
              // Look for product-like objects
              if (typeof data[key] === 'object' && data[key] !== null) {
                const obj = data[key];
                if (obj.name || obj.title || obj.productName) {
                  const productName = obj.name || obj.title || obj.productName;
                  const price = obj.price || obj.cost || obj.amount;
                  const productUrl = obj.url || obj.link || obj.href;
                  
                  if (productName && typeof productName === 'string' && productName.length > 3) {
                    const hasManual = productName.toLowerCase().includes('manual') || 
                                     productName.toLowerCase().includes('boxed') ||
                                     productName.toLowerCase().includes('complete') ||
                                     productName.toLowerCase().includes('w/ manual') ||
                                     productName.toLowerCase().includes('with manual');
                    
                    if (showAllProducts || hasManual) {
                      console.log(`Payload found product: "${productName}" - Price: ${price} - Manual: ${hasManual}`);
                      products.push({
                        name: productName,
                        price: price ? `£${price}` : undefined,
                        url: productUrl,
                        imageUrl: obj.image || obj.imageUrl || obj.thumbnail,
                        hasManual: hasManual
                      });
                    }
                  }
                }
              }
              
              extractProductsFromPayload(data[key], newPath);
            });
          }
        }
      };
      
      extractProductsFromPayload(payloadData);
      console.log(`Found ${products.length} products from payload data`);
    }

    for (const pattern of productCardPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const cardHtml = match[1];
        totalCards++;
        
        console.log(`Found card ${totalCards}, length: ${cardHtml.length}`);
        console.log(`Card content sample:`, cardHtml.substring(0, 500));
        
        // Skip very small cards (likely not products)
        if (cardHtml.length < 50) {
          console.log(`Skipping small card: ${cardHtml.length} chars`);
          continue;
        }
        
        // Extract product name - focus on CeX PLP structure
        const namePatterns = [
          // Look for product links first (most reliable for CeX)
          /<a[^>]*href="[^"]*product-detail[^"]*"[^>]*>([^<]+)<\/a>/i,
          // Look for product names in common CeX structures
          /<h[1-6][^>]*>([A-Za-z][A-Za-z0-9\s\-&.,'()]{3,80})<\/h[1-6]>/i,
          /<span[^>]*>([A-Za-z][A-Za-z0-9\s\-&.,'()]{3,80})<\/span>/i,
          /<div[^>]*>([A-Za-z][A-Za-z0-9\s\-&.,'()]{3,80})<\/div>/i,
          // Look for any text that looks like a product name
          /<[^>]*>([A-Za-z][A-Za-z0-9\s\-&.,'()]{3,80})<\/[^>]*>/i
        ];
        
        let productName = "";
        for (const namePattern of namePatterns) {
          const nameMatch = cardHtml.match(namePattern);
          if (nameMatch && nameMatch[1].trim().length > 3) {
            const candidate = nameMatch[1].trim();
            
            // Filter out CSS class names and other non-product text
            if (isValidProductName(candidate, showAllProducts)) {
              productName = candidate;
              break;
            }
          }
        }
        
        // If no specific name found, look for any text that contains "Manual" or "Boxed"
        if (!productName) {
          const manualMatch = cardHtml.match(/([A-Za-z0-9\s\-&.,'()]+(?:w\/\s*Manual|Manual\s*Included|Boxed|Complete)[A-Za-z0-9\s\-&.,'()]*)/i);
          if (manualMatch) {
            productName = manualMatch[1].trim();
          }
        }
        
        // If still no name, try to extract any meaningful text
        if (!productName) {
          const textMatch = cardHtml.match(/>([A-Za-z][A-Za-z0-9\s\-&.,'()]{5,100})</i);
          if (textMatch && isValidProductName(textMatch[1].trim(), showAllProducts)) {
            productName = textMatch[1].trim();
          }
        }
        
        // Skip if no meaningful name found
        if (!productName || productName.length < 3) {
          console.log(`Skipping card with no meaningful name. Card length: ${cardHtml.length}`);
          continue;
        }
        
        // Extract price - CeX uses numeric prices
        const pricePatterns = [
          /£(\d+(?:\.\d{2})?)/,
          /(\d+(?:\.\d{2})?)/  // Look for decimal prices
        ];
        
        let price = "";
        for (const pricePattern of pricePatterns) {
          const priceMatch = cardHtml.match(pricePattern);
          if (priceMatch) {
            price = priceMatch[1];
            break;
          }
        }
        
        // Extract URL - prioritize product-detail links
        const urlPatterns = [
          /href="([^"]*\/product-detail[^"]*)"/,
          /href='([^']*\/product-detail[^']*)'/,
          /href="([^"]+)"/,
          /href='([^']+)'/
        ];
        
        let productUrl = "";
        for (const urlPattern of urlPatterns) {
          const urlMatch = cardHtml.match(urlPattern);
          if (urlMatch && urlMatch[1]) {
            let url = urlMatch[1];
            // Make sure it's a full URL
            if (url.startsWith('/')) {
              url = 'https://uk.webuy.com' + url;
            }
            if (url.includes('/product-detail') || url.includes('webuy.com')) {
              productUrl = url;
              break;
            }
          }
        }
        
        // Extract image URL
        const imagePatterns = [
          /src="([^"]+)"/,
          /src='([^']+)'/
        ];
        
        let imageUrl = "";
        for (const imagePattern of imagePatterns) {
          const imageMatch = cardHtml.match(imagePattern);
          if (imageMatch && imageMatch[1].includes('http')) {
            imageUrl = imageMatch[1];
            break;
          }
        }
        
        // Check if product has manual - be more comprehensive
        const hasManual = cardHtml.toLowerCase().includes('manual') || 
                         cardHtml.toLowerCase().includes('boxed') ||
                         cardHtml.toLowerCase().includes('complete') ||
                         cardHtml.toLowerCase().includes('w/ manual') ||
                         cardHtml.toLowerCase().includes('with manual') ||
                         cardHtml.toLowerCase().includes('manual included') ||
                         productName.toLowerCase().includes('manual') ||
                         productName.toLowerCase().includes('boxed') ||
                         productName.toLowerCase().includes('complete');
        
        // Include products based on the showAllProducts flag
        if (showAllProducts || hasManual) {
          console.log(`Found product: "${productName}" - Manual: ${hasManual} - Price: ${price || 'N/A'} - ShowAll: ${showAllProducts}`);
          products.push({
            name: productName,
            price: price || undefined,
            url: productUrl || undefined,
            imageUrl: imageUrl || undefined,
            hasManual
          });
        } else {
          console.log(`Skipping product without manual: "${productName}"`);
        }
        
        processedCards++;
      }
    }
    
    console.log(`Found ${totalCards} total cards, processed ${processedCards} products`);
    console.log(`Products found:`, products.map(p => p.name));
    
    // If no products found with card patterns, try CeX-specific PLP extraction
    if (products.length === 0) {
      console.log("No products found with card patterns, trying CeX PLP-specific extraction...");
      
      // Look for CeX product structure: product links with names and prices
      // CeX uses numeric prices without £ symbol
      const cexProductPattern = /<a[^>]*href="([^"]*product-detail[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?([0-9]+\.[0-9]+)/gi;
      
      console.log("Trying CeX-specific pattern...");
      console.log("Looking for product-detail links in HTML...");
      
      // First, let's see if there are any product-detail links at all
      const productDetailLinks = html.match(/href="[^"]*product-detail[^"]*"/gi);
      console.log(`Found ${productDetailLinks ? productDetailLinks.length : 0} product-detail links`);
      if (productDetailLinks) {
        console.log("Sample product-detail links:", productDetailLinks.slice(0, 5));
      }
      
      let match;
      while ((match = cexProductPattern.exec(html)) !== null) {
        const productUrl = match[1];
        let productName = match[2].trim();
        const price = match[3];
        
        // Clean up the product name
        productName = productName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        if (isValidProductName(productName, showAllProducts)) {
          // Check for manual indicators
          const hasManual = productName.toLowerCase().includes('manual') || 
                           productName.toLowerCase().includes('boxed') ||
                           productName.toLowerCase().includes('complete') ||
                           productName.toLowerCase().includes('w/ manual') ||
                           productName.toLowerCase().includes('with manual');
          
          if (showAllProducts || hasManual) {
            console.log(`CeX PLP found product: "${productName}" - Price: £${price} - Manual: ${hasManual}`);
            
            // Make sure URL is full
            let fullUrl = productUrl;
            if (productUrl.startsWith('/')) {
              fullUrl = 'https://uk.webuy.com' + productUrl;
            }
            
            products.push({
              name: productName,
              price: `£${price}`,
              url: fullUrl,
              imageUrl: undefined,
              hasManual: hasManual
            });
          }
        }
      }
    }
    
    // Final debug: if still no products, let's see what we can find
    if (products.length === 0) {
      console.log("Still no products found. Let's debug what's in the HTML...");
      
      // Look for any text that might be product names
      const possibleProducts = html.match(/[A-Za-z][A-Za-z0-9\s\-&.,'()]{10,50}/g);
      console.log(`Found ${possibleProducts ? possibleProducts.length : 0} possible product-like text snippets`);
      if (possibleProducts) {
        console.log("Sample possible products:", possibleProducts.slice(0, 10));
      }
      
      // Look for any prices
      const prices = html.match(/£[0-9.]+/g);
      console.log(`Found ${prices ? prices.length : 0} prices`);
      if (prices) {
        console.log("Sample prices:", prices.slice(0, 10));
      }
      
      // Look for any links
      const links = html.match(/href="[^"]+"/g);
      console.log(`Found ${links ? links.length : 0} links`);
      if (links) {
        console.log("Sample links:", links.slice(0, 10));
      }
    }

    // Return the extracted products with debugging info
    return NextResponse.json({
      success: true,
      products,
      status: response.status,
      url: response.url,
      totalCards,
      processedCards,
      originalLength: html.length,
      debug: {
        htmlSample: html.substring(0, 2000),
        hasProductDetailLinks: html.includes('product-detail'),
        hasPrices: html.includes('£'),
        productDetailLinkCount: (html.match(/product-detail/g) || []).length,
        priceCount: (html.match(/£[0-9.]+/g) || []).length,
        // Look for other price patterns
        hasDollarPrices: html.includes('$'),
        hasNumericPrices: (html.match(/[0-9]+\.[0-9]+/g) || []).length,
        // Look for product-related text
        hasProductText: html.includes('product'),
        hasGameText: html.includes('game'),
        // Sample of product detail links
        productDetailLinks: (html.match(/href="[^"]*product-detail[^"]*"/g) || []).slice(0, 5),
        // Sample of all links to see what we're working with
        allLinks: (html.match(/href="[^"]+"/g) || []).slice(0, 10),
        // Look for API endpoints or fetch calls
        apiCalls: (html.match(/fetch\([^)]+\)/g) || []).slice(0, 5),
        // Look for any URLs that might be API endpoints
        possibleApiUrls: (html.match(/"[^"]*\/api\/[^"]*"/g) || []).slice(0, 5)
      }
    });

  } catch (error) {
    console.error("Server-side scraping error:", error);
    return NextResponse.json({ 
      error: `Server error: ${(error as Error).message}` 
    }, { status: 500 });
  }
}

