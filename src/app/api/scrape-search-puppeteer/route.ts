import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

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
  let browser;
  
  try {
    const { url, showAllProducts = false } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Puppeteer scraping URL: ${url}`);

    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('Page loaded, waiting for products to load...');

    // Wait for products to load - look for product elements
    try {
      await page.waitForSelector('a[href*="product-detail"]', { 
        timeout: 15000 
      });
      console.log('Found product links, waiting for content to load...');
    } catch (error) {
      console.log('No product selectors found, continuing anyway...');
    }

    // Wait for the page to fully load and render
    await page.waitForTimeout(5000);
    
    // Try to wait for any loading indicators to disappear
    try {
      await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], .loading, .spinner');
        return loadingElements.length === 0;
      }, { timeout: 10000 });
    } catch (error) {
      console.log('Loading indicators still present, continuing...');
    }

    // Extract products using JavaScript evaluation
    const products = await page.evaluate((showAllProducts) => {
      const productElements = [];
      
      // Look for product links specifically
      const productLinks = document.querySelectorAll('a[href*="product-detail"]');
      
      console.log(`Found ${productLinks.length} product links`);
      
      productLinks.forEach((link, index) => {
        if (link.textContent && link.textContent.trim().length > 5) {
          // Get the parent container to find price and other details
          const container = link.closest('div') || link.parentElement;
          const containerText = container ? container.textContent.trim() : '';
          
          // Also look for price elements near the link - try multiple selectors including CeX specific class
          let priceElement = container ? container.querySelector('.product-main-price, [class*="price"], [class*="cost"], [class*="amount"], [class*="value"], .price, .cost, .amount') : null;
          let priceText = priceElement ? priceElement.textContent.trim() : '';
          
          // If no price found in container, look in the parent container or nearby elements
          if (!priceText && container) {
            const parentContainer = container.parentElement;
            if (parentContainer) {
              priceElement = parentContainer.querySelector('.product-main-price, [class*="price"], [class*="cost"], [class*="amount"], [class*="value"], .price, .cost, .amount');
              priceText = priceElement ? priceElement.textContent.trim() : '';
            }
          }
          
          // If still no price, look for any element with product-main-price class in the entire document
          if (!priceText) {
            const allPriceElements = document.querySelectorAll('.product-main-price');
            // Try to find the price element that's closest to this product link
            let closestPriceElement = null;
            let minDistance = Infinity;
            
            allPriceElements.forEach(priceEl => {
              const distance = Math.abs(priceEl.compareDocumentPosition(link));
              if (distance < minDistance) {
                minDistance = distance;
                closestPriceElement = priceEl;
              }
            });
            
            if (closestPriceElement) {
              priceText = closestPriceElement.textContent.trim();
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
          
          // Debug: log the first few products to see the structure
          if (index < 3) {
            console.log(`Product ${index + 1}:`);
            console.log(`  Name: "${link.textContent.trim()}"`);
            console.log(`  Container text: "${containerText.substring(0, 100)}..."`);
            console.log(`  Final price text: ${priceText || 'none'}`);
            console.log(`  Fallback price: ${fallbackPrice || 'none'}`);
            
            // Check specifically for product-main-price class
            const mainPriceElement = container ? container.querySelector('.product-main-price') : null;
            console.log(`  Main price element in container: ${mainPriceElement ? mainPriceElement.textContent.trim() : 'none'}`);
            
            // Check how many product-main-price elements exist
            const allPriceElements = document.querySelectorAll('.product-main-price');
            console.log(`  Total product-main-price elements on page: ${allPriceElements.length}`);
            
            console.log(`  Container HTML: "${container ? container.innerHTML.substring(0, 200) : 'none'}..."`);
          }
          
          productElements.push({
            name: link.textContent.trim(),
            url: link.href,
            containerText: containerText,
            priceText: priceText || fallbackPrice,
            element: link.outerHTML
          });
        }
      });
      
      return productElements;
    }, showAllProducts);

    console.log(`Found ${products.length} potential product elements`);

    // Process the extracted elements
    const processedProducts: Array<{
      name: string;
      price?: string;
      url?: string;
      imageUrl?: string;
      hasManual: boolean;
    }> = [];

    for (const product of products) {
      const productName = product.name;
      const productUrl = product.url;
      const containerText = product.containerText;
      
      // Clean up the product name - remove extra text and numbers
      let cleanName = productName
        .replace(/^\d+/, '') // Remove leading numbers
        .replace(/Super NES Software|Mega Drive Software|SNES Software|NES Software/gi, '') // Remove console names
        .replace(/Home Alone, Unboxed£10\.00/g, 'Home Alone') // Fix specific case
        .replace(/£[0-9.]+/g, '') // Remove prices from name
        .replace(/^\s*,\s*/, '') // Remove leading commas
        .trim();
      
      // Extract price from container text and price text - look for various price patterns
      const pricePatterns = [
        /£([0-9]+\.?[0-9]*)/,
        /([0-9]+\.?[0-9]*)/,
        /Price:\s*£([0-9.]+)/i,
        /Cost:\s*£([0-9.]+)/i
      ];
      
      let price = undefined;
      const allText = `${containerText} ${product.priceText || ''}`;
      
      console.log(`Debug - Product: "${cleanName}"`);
      console.log(`Debug - Container text: "${containerText.substring(0, 200)}"`);
      console.log(`Debug - Price text: "${product.priceText || 'none'}"`);
      console.log(`Debug - All text: "${allText.substring(0, 200)}"`);
      
      // Try to find price in the container HTML first
      if (product.containerText) {
        const priceMatch = product.containerText.match(/£([0-9]+\.?[0-9]*)/);
        if (priceMatch) {
          price = `£${priceMatch[1]}`;
          console.log(`Debug - Found price in container text: ${price}`);
        }
      }
      
      // If no price found in HTML, try text patterns
      if (!price) {
        for (const pattern of pricePatterns) {
          const match = allText.match(pattern);
          if (match) {
            price = `£${match[1]}`;
            console.log(`Debug - Found price: ${price} using pattern: ${pattern}`);
            break;
          }
        }
      }
      
      if (!price) {
        console.log(`Debug - No price found for "${cleanName}"`);
      }
      
      // Check for manual and boxed indicators - must have BOTH
      const hasManual = cleanName.toLowerCase().includes('w/ manual') || 
                       cleanName.toLowerCase().includes('with manual') ||
                       cleanName.toLowerCase().includes('manual included');
      
      const hasBoxed = cleanName.toLowerCase().includes('boxed');
      
      // Only include products that have manual AND are boxed (not unboxed or w/o manual)
      const isValidProduct = hasManual && hasBoxed && 
                            !cleanName.toLowerCase().includes('unboxed') &&
                            !cleanName.toLowerCase().includes('w/o manual') &&
                            !cleanName.toLowerCase().includes('without manual');
      
      if (isValidProduct && cleanName.length > 3) {
        console.log(`Found valid product: "${cleanName}" - Price: ${price} - Manual: ${hasManual} - Boxed: ${hasBoxed}`);
        console.log(`Container text: "${containerText.substring(0, 200)}"`);
        console.log(`Price text: "${product.priceText || 'none'}"`);
        
        processedProducts.push({
          name: cleanName,
          price: price,
          url: productUrl,
          imageUrl: undefined,
          hasManual: true
        });
      } else {
        console.log(`Skipping product: "${cleanName}" - Manual: ${hasManual} - Boxed: ${hasBoxed} - Unboxed: ${cleanName.toLowerCase().includes('unboxed')}`);
      }
    }

    // Remove duplicates based on name
    const uniqueProducts = processedProducts.filter((product, index, self) => 
      index === self.findIndex(p => p.name === product.name)
    );

    console.log(`Processed ${uniqueProducts.length} unique products`);

    return NextResponse.json({
      success: true,
      products: uniqueProducts,
      debug: {
        totalElements: products.length,
        processedProducts: processedProducts.length,
        uniqueProducts: uniqueProducts.length,
        showAllProducts: showAllProducts
      }
    });

  } catch (error) {
    console.error("Puppeteer scraping error:", error);
    return NextResponse.json({ 
      error: `Puppeteer error: ${(error as Error).message}`,
      success: false
    }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
