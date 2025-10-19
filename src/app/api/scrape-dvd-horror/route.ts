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
    
    // Navigate to the page with optimized settings
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });

    console.log('Page loaded, waiting for products to load...');

    // Wait for products to load - look for product elements with reduced timeout
    try {
      await page.waitForSelector('a[href*="product-detail"]', { 
        timeout: 8000 
      });
      console.log('Found product links, waiting for content to load...');
    } catch (error) {
      console.log('No product selectors found, continuing anyway...');
    }

    // Try to wait for any loading indicators to disappear with reduced timeout
    try {
      await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], .loading, .spinner');
        return loadingElements.length === 0;
      }, { timeout: 5000 });
    } catch (error) {
      console.log('Loading indicators still present, continuing...');
    }

    // Extract products using JavaScript evaluation
    const products = await page.evaluate((showAllProducts: boolean) => {
      const productElements: Array<{
        name: string;
        url: string;
        containerText: string;
        priceText: string;
        imageUrl: string;
        element: string;
      }> = [];
      
      // Look for product links specifically
      const productLinks = document.querySelectorAll('a[href*="product-detail"]');
      
      console.log(`Found ${productLinks.length} product links`);
      
      productLinks.forEach((link, index) => {
        if (link.textContent && link?.textContent.trim().length > 5) {
          // Get the parent container to find price and other details
          const container = link.closest('div') || link.parentElement;
          const containerText = container && container.textContent ? container.textContent.trim() : '';
          
          // Also look for price elements near the link - try multiple selectors including CeX specific class
          let priceElement = container ? container.querySelector('.product-main-price, [class*="price"], [class*="cost"], [class*="amount"], [class*="value"], .price, .cost, .amount') : null;
          let priceText = priceElement && priceElement.textContent ? priceElement.textContent.trim() : '';
          
          // If no price found in container, look in the parent container or nearby elements
          if (!priceText && container) {
            const parentContainer = container.parentElement;
            if (parentContainer) {
              priceElement = parentContainer.querySelector('.product-main-price, [class*="price"], [class*="cost"], [class*="amount"], [class*="value"], .price, .cost, .amount');
              priceText = priceElement && priceElement.textContent ? priceElement.textContent.trim() : '';
            }
          }
          
          // If still no price, look for any element with product-main-price class in the entire document
          if (!priceText) {
            const allPriceElements = document.querySelectorAll('.product-main-price');
            // Try to find the price element that's closest to this product link
            let closestPriceElement: Element | null = null;
            let minDistance = Infinity;
            
            allPriceElements.forEach(priceEl => {
              const distance = Math.abs(priceEl.compareDocumentPosition(link));
              if (distance < minDistance) {
                minDistance = distance;
                closestPriceElement = priceEl;
              }
            });
            
            if (closestPriceElement && (closestPriceElement as Element).textContent) {
              priceText = (closestPriceElement as Element).textContent!.trim();
            }
          }
          
          // If no price element found, look for any text that looks like a price in the container
          let fallbackPrice = '';
          if (!priceText && container) {
            const containerHTML = container.innerHTML;
            const priceMatch = containerHTML.match(/£[0-9]+\.?[0-9]*/);
            if (priceMatch) {
              fallbackPrice = priceMatch[0];
            }
          }
          
          // Use the best price we found
          const finalPrice = priceText || fallbackPrice || 'Price not found';
          
          // Get product image
          const imgElement = container ? container.querySelector('img') : null;
          const imageUrl = imgElement && imgElement.src ? imgElement.src : '';
          
          // Get product ID from URL
          let productId = '';
          const linkElement = link as HTMLAnchorElement;
          if (linkElement.href) {
            const urlMatch = linkElement.href.match(/\/product\/([^\/\?]+)/);
            if (urlMatch) {
              productId = urlMatch[1];
            }
          }
          
          // Generate a fallback ID if none found
          if (!productId) {
            productId = `dvd-horror-${index}-${Date.now()}`;
          }
          
          // Check for manual/box indicators
          const hasManual = /w\/\s*manual|with\s+manual|\+\s*manual|manual\s+included/i.test(containerText);
          const isBoxed = /boxed|in\s+box|original\s+box/i.test(containerText) && !/unboxed|loose|no\s+box|disc\s+only/i.test(containerText);
          
          console.log(`Debug - Product: "${link.textContent.trim()}"`);
          console.log(`Debug - Container text: "${containerText}"`);
          console.log(`Debug - Price text: "${finalPrice}"`);
          console.log(`Debug - All text: "${containerText}"`);
          console.log(`Debug - Found price: ${finalPrice} using pattern: /£([0-9]+\.?[0-9]*)/`);
          console.log(`Found product: "${link.textContent.trim()}" - Price: ${finalPrice} - Manual: ${hasManual} - Boxed: ${isBoxed} - ProductID: ${productId}`);
          
          productElements.push({
            name: link.textContent.trim(),
            url: linkElement.href,
            containerText,
            priceText: finalPrice,
            imageUrl,
            element: link.outerHTML
          });
        }
      });
      
      // Convert to the expected format
      const products: any[] = [];
      const seenProducts = new Set<string>();
      
      productElements.forEach((product, index) => {
        // Skip if we've seen this product before
        if (seenProducts.has(product.name)) {
          return;
        }
        seenProducts.add(product.name);
        
        products.push({
          productId: `dvd-horror-${index}-${Date.now()}`,
          name: product.name,
          price: product.priceText,
          url: product.url,
          imageUrl: product.imageUrl,
          store: 'Unknown', // Will be updated by the calling page
          categoryId: 'horror', // DVD Horror category
          hasManual: /w\/\s*manual|with\s+manual|\+\s*manual|manual\s+included/i.test(product.containerText),
          isBoxed: /boxed|in\s+box|original\s+box/i.test(product.containerText) && !/unboxed|loose|no\s+box|disc\s+only/i.test(product.containerText)
        });
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
