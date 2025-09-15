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

    console.log(`Browser scraping URL: ${url}`);

    // Try using a headless browser service
    // Option 1: Try Browserless.io (if available)
    const browserlessUrl = process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
    
    try {
      const browserResponse = await fetch(`${browserlessUrl}/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          url: url,
          waitFor: 5000, // Wait 5 seconds for page to load
          gotoOptions: {
            waitUntil: 'networkidle2'
          }
        })
      });

      if (browserResponse.ok) {
        const html = await browserResponse.text();
        console.log(`Browser response HTML length: ${html.length}`);
        
        // Now extract products from the fully loaded HTML
        const products = await extractProductsFromHTML(html, showAllProducts);
        
        return NextResponse.json({
          success: true,
          products: products,
          method: 'browserless',
          htmlLength: html.length
        });
      }
    } catch (error) {
      console.log('Browserless failed:', error);
    }

    // Option 2: Try ScrapingBee (if available)
    const scrapingBeeUrl = process.env.SCRAPINGBEE_URL;
    if (scrapingBeeUrl) {
      try {
        const scrapingBeeResponse = await fetch(scrapingBeeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: url,
            render_js: true,
            wait: 5000,
            wait_for: 'networkidle2'
          })
        });

        if (scrapingBeeResponse.ok) {
          const html = await scrapingBeeResponse.text();
          console.log(`ScrapingBee response HTML length: ${html.length}`);
          
          const products = await extractProductsFromHTML(html, showAllProducts);
          
          return NextResponse.json({
            success: true,
            products: products,
            method: 'scrapingbee',
            htmlLength: html.length
          });
        }
      } catch (error) {
        console.log('ScrapingBee failed:', error);
      }
    }

    // Option 3: Fallback to regular fetch with delay
    console.log('Falling back to regular fetch...');
    
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "cache-control": "no-cache",
        "pragma": "no-cache"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      }, { status: response.status });
    }

    const html = await response.text();
    const products = await extractProductsFromHTML(html, showAllProducts);
    
    return NextResponse.json({
      success: true,
      products: products,
      method: 'fallback',
      htmlLength: html.length
    });

  } catch (error) {
    console.error("Browser scraping error:", error);
    return NextResponse.json({ 
      error: `Browser error: ${(error as Error).message}`,
      success: false
    }, { status: 500 });
  }
}

async function extractProductsFromHTML(html: string, showAllProducts: boolean) {
  const products: Array<{
    name: string;
    price?: string;
    url?: string;
    imageUrl?: string;
    hasManual: boolean;
  }> = [];

  // Look for product elements in the fully loaded HTML
  const productSelectors = [
    // Look for product links
    /<a[^>]*href="([^"]*product-detail[^"]*)"[^>]*>([^<]+)<\/a>/gi,
    // Look for product cards
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Look for any element containing product names and prices
    /<[^>]*>([^<]*(?:Pop|Super|Metroid|TwinBee|Populous)[^<]*)<\/[^>]*>/gi
  ];

  for (const selector of productSelectors) {
    let match;
    while ((match = selector.exec(html)) !== null) {
      const productName = match[2] || match[1];
      const productUrl = match[1];
      
      if (productName && isValidProductName(productName, showAllProducts)) {
        // Look for price near this element
        const priceMatch = html.substring(match.index, match.index + 1000).match(/£([0-9.]+)|([0-9]+\.[0-9]+)/);
        const price = priceMatch ? (priceMatch[1] || priceMatch[2]) : undefined;
        
        // Check for manual indicators
        const hasManual = productName.toLowerCase().includes('manual') || 
                         productName.toLowerCase().includes('boxed') ||
                         productName.toLowerCase().includes('complete') ||
                         productName.toLowerCase().includes('w/ manual') ||
                         productName.toLowerCase().includes('with manual');
        
        if (showAllProducts || hasManual) {
          console.log(`Found product: "${productName}" - Price: ${price} - Manual: ${hasManual}`);
          
          products.push({
            name: productName,
            price: price ? `£${price}` : undefined,
            url: productUrl ? (productUrl.startsWith('/') ? 'https://uk.webuy.com' + productUrl : productUrl) : undefined,
            imageUrl: undefined,
            hasManual: hasManual
          });
        }
      }
    }
  }

  // Remove duplicates
  const uniqueProducts = products.filter((product, index, self) => 
    index === self.findIndex(p => p.name === product.name)
  );

  return uniqueProducts;
}
