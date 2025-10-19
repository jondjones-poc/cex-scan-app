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
export const maxDuration = 30;

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
        headless
      });
      
      console.log('Browser launched successfully with chromium package');
    } else {
      // Local development: use regular puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
      });
      
      console.log('Browser launched successfully with regular puppeteer');
    }

    const page = await browser.newPage();
    
    // Block images, stylesheets, and fonts for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    console.log('Navigating to page...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    console.log('Page loaded, waiting for products to load...');
    
    // Get page title and URL for debugging
    const pageTitle = await page.title();
    const currentUrl = page.url();
    console.log(`Page title: ${pageTitle}`);
    console.log(`Current URL: ${currentUrl}`);
    
    // Debug: Check what's actually on the page
    const pageContent = await page.evaluate(() => {
      return {
        totalLinks: document.querySelectorAll('a').length,
        productLinks: document.querySelectorAll('a[href*="product"]').length,
        searchResults: document.querySelectorAll('[class*="search-result"]').length,
        bodyText: document.body.textContent?.substring(0, 500) || 'No body text'
      };
    });
    console.log('Page debug info:', pageContent);
    
    // Wait for product elements to appear - try multiple selectors for Horror DVDs
    try {
      await page.waitForSelector('a[href*="/product/"], a[href*="product-detail"], .search-result-item, [class*="search-result"]', { timeout: 8000 });
      console.log('Found product links, waiting for content to load...');
    } catch (error) {
      console.log('No product links found, continuing...');
    }

    // Wait for loading indicators to disappear
    try {
      await page.waitForFunction(
        () => !document.querySelector('.loading, .spinner, [class*="loading"]'),
        { timeout: 5000 }
      );
      console.log('Loading indicators cleared');
    } catch (error) {
      console.log('Loading indicators still present, continuing...');
    }
    
    // Additional wait for Horror DVDs to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const products = await page.evaluate(() => {
      const productElements: Array<{
        name: string;
        url: string;
        containerText: string;
        priceText: string;
        element: string;
      }> = [];

      // Try multiple selectors for Horror DVDs
      const selectors = [
        'a[href*="/product/"]',
        'a[href*="product-detail"]', 
        'a[href*="product"]',
        '.search-result-item a',
        '[class*="search-result"] a'
      ];
      
      let allLinks: NodeListOf<Element> | null = null;
      let selectorUsed = '';
      
      for (const selector of selectors) {
        allLinks = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": Found ${allLinks.length} links`);
        if (allLinks.length > 0) {
          selectorUsed = selector;
          break;
        }
      }
      
      if (!allLinks || allLinks.length === 0) {
        console.log('No product links found with any selector');
        return productElements;
      }
      
      console.log(`Using selector "${selectorUsed}" with ${allLinks.length} links`);

      allLinks.forEach((link, index) => {
        if (index >= 50) return; // Limit to first 50 products
        
        const href = (link as HTMLAnchorElement).href;
        const name = link.textContent?.trim() || '';
        
        if (!name || name.length < 3) return;
        
        // Get container text for price extraction
        const container = link.closest('[class*="product"], [class*="item"], [class*="card"], [class*="search-result"]') || link.parentElement;
        const containerText = container ? container.textContent || '' : '';
        
        // Try to find price element
        let priceText = '';
        const priceElement = container?.querySelector('[class*="price"], [class*="cost"], .product-main-price');
        if (priceElement && priceElement.textContent) {
          priceText = priceElement.textContent.trim();
        }
        
        console.log(`Product ${index}: "${name}" - Price: "${priceText}"`);
        
        productElements.push({
          name,
          url: href,
          containerText,
          priceText,
          element: container?.outerHTML?.substring(0, 200) || ''
        });
      });

      return productElements;
    });

    console.log(`Found ${products.length} potential products`);

    const processedProducts: Array<{
      name: string;
      price: string;
      url: string;
      categoryId: string;
    }> = [];

    // Extract category ID from URL
    const categoryMatch = url.match(/categoryIds=(\d+)/);
    const categoryId = categoryMatch ? categoryMatch[1] : 'horror';

    for (const product of products) {
      let cleanName = product.name;
      
      // Clean up the product name
      cleanName = cleanName
        .replace(/^\d+/, '') // Remove leading numbers
        .replace(/£\d+(\.\d{2})?/g, '') // Remove prices
        .replace(/^,\s*/, '') // Remove leading commas
        .trim();

      if (cleanName.length < 3) continue;

      // Extract price
      let price = 'N/A';
      const pricePatterns = [
        /£([0-9]+\.?[0-9]*)/,
        /([0-9]+\.?[0-9]*)\s*£/,
        /price[:\s]*£([0-9]+\.?[0-9]*)/i
      ];

      const allText = `${product.name} ${product.containerText} ${product.priceText}`;
      
      for (const pattern of pricePatterns) {
        const match = allText.match(pattern);
        if (match) {
          price = `£${match[1]}`;
          break;
        }
      }

      // For Horror DVDs, we don't filter by manual/boxed - just include all products
      if (cleanName.length > 3) {
        processedProducts.push({
          name: cleanName,
          price: price,
          url: product.url,
          categoryId: categoryId
        });
      }
    }

    console.log(`Processed ${processedProducts.length} unique products`);

    await browser.close();

    return NextResponse.json({
      products: processedProducts,
      hasNextPage: false, // For now, just return first page
      totalFound: processedProducts.length
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
