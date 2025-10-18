import { NextRequest, NextResponse } from "next/server";

// Use different packages for local vs production
const isNetlify = process.env.NETLIFY === 'true' || process.env.NODE_ENV === 'production';

let chromium: any;
let puppeteer: any;

if (isNetlify) {
  // Production: use puppeteer-core with @sparticuz/chromium
  chromium = require("@sparticuz/chromium");
  puppeteer = require("puppeteer-core");
} else {
  // Local development: use regular puppeteer
  puppeteer = require("puppeteer");
}

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
  
  // Reject if it's too short
  if (text.length < 3) {
    return false;
  }
  
  // Reject if it's too long (likely not a product name)
  if (text.length > 200) {
    return false;
  }
  
  // Reject if it's mostly numbers
  const numberCount = (text.match(/\d/g) || []).length;
  if (numberCount > text.length * 0.7) {
    return false;
  }
  
  // Reject if it contains common non-product indicators
  const nonProductIndicators = [
    'class=', 'id=', 'style=', 'href=', 'src=', 'alt=',
    'width=', 'height=', 'border=', 'margin=', 'padding=',
    'display:', 'position:', 'float:', 'clear:', 'overflow:',
    'font-', 'text-', 'background-', 'border-', 'margin-',
    'padding-', 'top:', 'right:', 'bottom:', 'left:',
    'z-index:', 'opacity:', 'visibility:', 'cursor:',
    'user-select:', 'pointer-events:', 'transform:',
    'transition:', 'animation:', 'keyframes'
  ];
  
  if (nonProductIndicators.some(indicator => text.toLowerCase().includes(indicator))) {
    return false;
  }
  
  return true;
}

// Helper function to extract price from text
function extractPrice(text: string): string | null {
  // Look for price patterns like £X.XX, £X, £XX.XX, etc.
  const pricePatterns = [
    /£([0-9]+\.?[0-9]*)/g,
    /£\s*([0-9]+\.?[0-9]*)/g,
    /([0-9]+\.?[0-9]*)\s*£/g
  ];
  
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the first match, ensuring it has £ symbol
      const priceText = match[0];
      if (priceText.includes('£')) {
        return priceText;
      }
    }
  }
  
  return null;
}

// Helper function to check if product has manual/box indicators
function checkProductCondition(text: string): { hasManual: boolean; isBoxed: boolean } {
  const manualIndicators = [
    'w/ manual', 'with manual', '+ manual', 'manual included',
    'w/ Manual', 'With Manual', '+ Manual', 'Manual Included'
  ];
  
  const boxedIndicators = [
    'boxed', 'Boxed', 'BOXED', 'in box', 'In Box', 'IN BOX',
    'original box', 'Original Box', 'ORIGINAL BOX'
  ];
  
  const unboxedIndicators = [
    'unboxed', 'Unboxed', 'UNBOXED', 'loose', 'Loose', 'LOOSE',
    'no box', 'No Box', 'NO BOX', 'disc only', 'Disc Only', 'DISC ONLY'
  ];
  
  const hasManual = manualIndicators.some(indicator => text.includes(indicator));
  const isBoxed = boxedIndicators.some(indicator => text.includes(indicator));
  const isUnboxed = unboxedIndicators.some(indicator => text.includes(indicator));
  
  return {
    hasManual,
    isBoxed: isBoxed && !isUnboxed
  };
}

export async function POST(request: NextRequest) {
  let browser;
  
  try {
    const { url, showAllProducts = false } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    
    console.log(`Puppeteer scraping DVD Horror URL: ${url}`);
    console.log(`Environment: ${isNetlify ? 'Netlify (production)' : 'Local development'}`);

    if (isNetlify) {
      // Production: use @sparticuz/chromium
      const executablePath = await chromium.executablePath();
      console.log("Using Chromium path:", executablePath);

      const headless: boolean | "shell" = chromium.headless === true ? true : "shell";

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Local development: use regular puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        ignoreHTTPSErrors: true,
      });
    }

    console.log("Browser launched successfully with regular puppeteer");

    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    console.log("Page loaded, waiting for products to load...");
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for products to load - use more specific selectors for CEX product tiles
    await page.waitForSelector('[data-testid="product-tile"], .product-tile, .product-item, [class*="product"], .search-result-item, [class*="search-result"]', { timeout: 10000 });
    
    console.log("Found product links, waiting for content to load...");
    
    // Wait a bit more for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for loading indicators and wait for them to disappear
    const loadingSelectors = [
      '.loading', '.spinner', '.loader', '[class*="loading"]', '[class*="spinner"]'
    ];
    
    for (const selector of loadingSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        console.log("Loading indicators still present, continuing...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Loading indicator not found, continue
      }
    }

    // Extract product information
    const products = await page.evaluate((showAllProducts) => {
      const productElements = document.querySelectorAll('[data-testid="product-tile"], .product-tile, .product-item, [class*="product"], .search-result-item, [class*="search-result"]');
      console.log(`Found ${productElements.length} potential product elements`);
      
      const products: any[] = [];
      const seenProducts = new Set<string>();
      
      productElements.forEach((element, index) => {
        try {
          // Get the main container text
          const containerText = element.textContent || '';
          
          // Skip if container is too short or doesn't look like a product
          if (containerText.length < 10) {
            return;
          }
          
          // Skip header/navigation elements
          if (containerText.includes('Categories in DVD') || 
              containerText.includes('Refine Your Search') ||
              containerText.includes('Reset') ||
              containerText.includes('By Availability') ||
              containerText.includes('In Stock Online') ||
              containerText.includes('In Stock In Store') ||
              containerText.includes('Product Image') ||
              containerText.includes('Product Type') ||
              containerText.includes('Type of Product') ||
              containerText.includes('DVD Adult') ||
              containerText.includes('DVD Anime') ||
              containerText.includes('results')) {
            return;
          }
          
          // Look for product name (usually the first substantial text)
          const textNodes = Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent?.trim())
            .filter(text => text && text.length > 3);
          
          let productName = '';
          let price = '';
          
          // Try to find product name and price in the text
          const fullText = containerText;
          
          // Look for price patterns
          const priceMatch = fullText.match(/£([0-9]+\.?[0-9]*)/);
          if (priceMatch) {
            price = `£${priceMatch[1]}`;
          }
          
          // Skip if no valid price found (likely not a real product)
          if (!price || price === '£1' || price === '£0') {
            return;
          }
          
          // Extract product name (everything before the price)
          if (price) {
            const priceIndex = fullText.indexOf(price);
            productName = fullText.substring(0, priceIndex).trim();
          } else {
            // If no price found, take the first substantial text
            productName = textNodes[0] || fullText.substring(0, 100);
          }
          
          // Clean up product name
          productName = productName
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '')
            .substring(0, 200);
          
          // Skip if product name is too short or invalid
          if (productName.length < 3) {
            return;
          }
          
          // Skip if we've seen this product before
          if (seenProducts.has(productName)) {
            return;
          }
          seenProducts.add(productName);
          
          // Get product URL
          const linkElement = element.querySelector('a[href*="/product/"]') as HTMLAnchorElement;
          const productUrl = linkElement ? linkElement.href : '';
          
          // Get product image
          const imgElement = element.querySelector('img') as HTMLImageElement;
          const imageUrl = imgElement ? imgElement.src : '';
          
          // Get product ID from URL or other attributes
          let productId = '';
          if (productUrl) {
            const urlMatch = productUrl.match(/\/product\/([^\/\?]+)/);
            if (urlMatch) {
              productId = urlMatch[1];
            }
          }
          
          // If no product ID from URL, try to get it from data attributes
          if (!productId) {
            const dataProductId = element.getAttribute('data-product-id') || 
                                 element.getAttribute('data-id') || 
                                 element.getAttribute('id');
            if (dataProductId) {
              productId = dataProductId;
            }
          }
          
          // Generate a fallback ID if none found
          if (!productId) {
            productId = `dvd-horror-${index}-${Date.now()}`;
          }
          
          // Check for manual/box indicators
          const hasManual = /w\/\s*manual|with\s+manual|\+\s*manual|manual\s+included/i.test(fullText);
          const isBoxed = /boxed|in\s+box|original\s+box/i.test(fullText) && !/unboxed|loose|no\s+box|disc\s+only/i.test(fullText);
          
          console.log(`Debug - Product: "${productName}"`);
          console.log(`Debug - Container text: "${containerText}"`);
          console.log(`Debug - Price text: "${price}"`);
          console.log(`Debug - All text: "${fullText}"`);
          console.log(`Debug - Found price: ${price} using pattern: /£([0-9]+\.?[0-9]*)/`);
          console.log(`Found product: "${productName}" - Price: ${price} - Manual: ${hasManual} - Boxed: ${isBoxed} - ProductID: ${productId}`);
          
          products.push({
            productId,
            name: productName,
            price: price || 'Price not found',
            url: productUrl,
            imageUrl: imageUrl,
            store: 'Unknown', // Will be updated by the calling page
            categoryId: 'horror', // DVD Horror category
            hasManual,
            isBoxed
          });
          
        } catch (error) {
          console.error('Error processing product element:', error);
        }
      });
      
      return products;
    }, showAllProducts);

    console.log(`Processed ${products.length} unique products`);
    
    await browser.close();
    
    return NextResponse.json({ 
      success: true, 
      products: products,
      count: products.length 
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    
    if (browser) {
      await browser.close();
    }
    
    return NextResponse.json({ 
      error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
