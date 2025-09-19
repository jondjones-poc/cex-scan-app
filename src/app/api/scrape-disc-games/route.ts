import { NextRequest, NextResponse } from "next/server";

// Use regular puppeteer everywhere - let it handle Chrome installation
const puppeteer = require('puppeteer');
const isNetlify = process.env.NETLIFY === 'true' || process.env.VERCEL || process.env.NETLIFY_URL || process.env.NODE_ENV === 'production';

console.log('Environment check:', { 
  NETLIFY: process.env.NETLIFY, 
  VERCEL: process.env.VERCEL, 
  NETLIFY_URL: process.env.NETLIFY_URL, 
  NODE_ENV: process.env.NODE_ENV,
  isNetlify,
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH
});

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Starting disc-based games scrape for: ${url}`);
    console.log(`Using regular puppeteer for ${isNetlify ? 'production' : 'development'}`);

    // Launch Puppeteer browser with optimized settings
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',
      '--disable-javascript-harmony-shipping',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];

    // Use environment variable for executable path if available (for Netlify)
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    
    if (executablePath) {
      console.log(`Using custom executable path: ${executablePath}`);
    } else {
      console.log('Using default puppeteer executable');
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath,
      args: launchArgs
    });

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
    
    // Wait for product elements to appear
    try {
      await page.waitForSelector('a[href*="/product/"]', { timeout: 8000 });
      console.log('Found product links, waiting for content to load...');
    } catch (error) {
      console.log('No product links found, continuing...');
    }

    // Wait for loading indicators to disappear
    await page.waitForTimeout(2000);
    
    try {
      await page.waitForFunction(
        () => !document.querySelector('.loading, .spinner, [class*="loading"]'),
        { timeout: 5000 }
      );
      console.log('Loading indicators cleared');
    } catch (error) {
      console.log('Loading indicators still present, continuing...');
    }

    const products = await page.evaluate(() => {
      const productElements: Array<{
        name: string;
        url: string;
        containerText: string;
        priceText: string;
        element: string;
      }> = [];

      // Find all product links
      const links = document.querySelectorAll('a[href*="/product/"]');
      console.log(`Found ${links.length} potential product elements`);
      
      // Also try alternative selectors
      const altLinks = document.querySelectorAll('a[href*="product"]');
      console.log(`Found ${altLinks.length} alternative product links`);
      
      // Check for any links at all
      const allLinks = document.querySelectorAll('a');
      console.log(`Found ${allLinks.length} total links on page`);

      links.forEach((link, index) => {
        if (index >= 50) return; // Limit to first 50 products
        
        const href = (link as HTMLAnchorElement).href;
        const name = link.textContent?.trim() || '';
        
        if (!name || name.length < 3) return;
        
        // Get container text for price extraction
        const container = link.closest('[class*="product"], [class*="item"], [class*="card"]') || link.parentElement;
        const containerText = container ? container.textContent || '' : '';
        
        // Try to find price element
        let priceText = '';
        const priceElement = container?.querySelector('[class*="price"], [class*="cost"], .product-main-price');
        if (priceElement && priceElement.textContent) {
          priceText = priceElement.textContent.trim();
        }
        
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
    const categoryId = categoryMatch ? categoryMatch[1] : '';

    for (const product of products) {
      let cleanName = product.name;
      
      // Clean up the product name
      cleanName = cleanName
        .replace(/^\d+/, '') // Remove leading numbers
        .replace(/^(PlayStation|Xbox|Nintendo|PC|PS|Xbox|Switch)\s+/i, '') // Remove console prefixes
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

      // For disc-based games, we don't filter by manual/boxed - just include all products
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
    console.error('Disc games scrape error:', error);
    return NextResponse.json(
      { error: `Scraping failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
