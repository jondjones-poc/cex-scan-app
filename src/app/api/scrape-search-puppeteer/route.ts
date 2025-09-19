import { NextRequest, NextResponse } from "next/server";
// at top of your API file
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

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
    // Launch Puppeteer browser with optimized settings
    const launchArgs = [
      '--no-sandbox'
    ];
   
    try {
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
    } catch (error) {
      console.error('Chrome launch failed:', error);
      console.error('Full error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      throw new Error(`Chrome launch failed: ${(error as Error).message}`);
    }
   

    const page = await browser.newPage();
    
    // Allow images to load for URL extraction, but block CSS and fonts for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const resourceType = req.resourceType();
      if (resourceType === 'stylesheet' || resourceType === 'font') {
        req.abort();
      } else if (resourceType === 'image') {
        // Allow images to load so we can extract their URLs
        req.continue();
      } else {
        req.continue();
      }
    });
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

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

    // Reduced wait time for page rendering
   // await page.waitForTimeout(2000);
    
    // Try to wait for any loading indicators to disappear with reduced timeout
    try {
      await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], .loading, .spinner');
        return loadingElements.length === 0;
      }, { timeout: 5000 });
    } catch (error) {
      console.log('Loading indicators still present, continuing...');
    }
    
    // Wait a bit more for images to load
    //await page.waitForTimeout(2000);

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
          
          // Debug: log the first few products to see the structure
          if (index < 3) {
            console.log(`Product ${index + 1}:`);
            console.log(`  Name: "${link.textContent!.trim()}"`);
            console.log(`  Container text: "${containerText ? containerText.substring(0, 100) : 'none'}..."`);
            console.log(`  Final price text: ${priceText || 'none'}`);
            console.log(`  Fallback price: ${fallbackPrice || 'none'}`);
            
            // Check specifically for product-main-price class
            const mainPriceElement = container ? container.querySelector('.product-main-price') : null;
            console.log(`  Main price element in container: ${mainPriceElement && mainPriceElement.textContent ? mainPriceElement.textContent.trim() : 'none'}`);
            
            // Check how many product-main-price elements exist
            const allPriceElements = document.querySelectorAll('.product-main-price');
            console.log(`  Total product-main-price elements on page: ${allPriceElements.length}`);
            
            console.log(`  Container HTML: "${container ? container.innerHTML.substring(0, 200) : 'none'}..."`);
          }
          
          // Look for product image in the container and nearby elements
          let imageUrl = '';
          if (container) {
            // First try to find image in the container
            const imgElement = container.querySelector('img');
            if (imgElement && imgElement.src) {
              imageUrl = imgElement.src;
            } else {
              // Try to find image in parent container
              const parentContainer = container.parentElement;
              if (parentContainer) {
                const parentImg = parentContainer.querySelector('img');
                if (parentImg && parentImg.src) {
                  imageUrl = parentImg.src;
                } else {
                  // Try to find image in grandparent container
                  const grandparentContainer = parentContainer.parentElement;
                  if (grandparentContainer) {
                    const grandparentImg = grandparentContainer.querySelector('img');
                    if (grandparentImg && grandparentImg.src) {
                      imageUrl = grandparentImg.src;
                    }
                  }
                }
              }
            }
          }
          
          // If still no image found, try to find any image near the product link
          if (!imageUrl) {
            const linkRect = link.getBoundingClientRect();
            const allImages = document.querySelectorAll('img');
            let closestImage: HTMLImageElement | null = null;
            let minDistance = Infinity;
            
            allImages.forEach(img => {
              if (img.src && !img.src.includes('data:')) {
                const imgRect = img.getBoundingClientRect();
                const distance = Math.sqrt(
                  Math.pow(linkRect.left - imgRect.left, 2) + 
                  Math.pow(linkRect.top - imgRect.top, 2)
                );
                if (distance < minDistance && distance < 200) { // Within 200px
                  minDistance = distance;
                  closestImage = img;
                }
              }
            });
            
            if (closestImage) {
              imageUrl = (closestImage as HTMLImageElement).src;
            }
          }
          
          // Debug: log image extraction for first few products
          if (index < 3) {
            console.log(`  Image URL: ${imageUrl || 'none'}`);
            if (container) {
              const allImages = container.querySelectorAll('img');
              console.log(`  Total images in container: ${allImages.length}`);
              allImages.forEach((img, imgIndex) => {
                console.log(`    Image ${imgIndex}: ${img.src || 'no src'}`);
              });
              
              // Also check parent container
              const parentContainer = container.parentElement;
              if (parentContainer) {
                const parentImages = parentContainer.querySelectorAll('img');
                console.log(`  Total images in parent container: ${parentImages.length}`);
                parentImages.forEach((img, imgIndex) => {
                  console.log(`    Parent Image ${imgIndex}: ${img.src || 'no src'}`);
                });
              }
            }
          }
          
          productElements.push({
            name: link.textContent!.trim(),
            url: (link as HTMLAnchorElement).href,
            containerText: containerText,
            priceText: priceText || fallbackPrice,
            imageUrl: imageUrl,
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
      
      // Determine if product is valid based on showAllProducts flag
      let isValidProduct;
      if (showAllProducts) {
        // For disc-based games, include all products regardless of manual/boxed status
        isValidProduct = cleanName.length > 3;
      } else {
        // For retro games, only include products that have manual AND are boxed
        isValidProduct = hasManual && hasBoxed && 
                        !cleanName.toLowerCase().includes('unboxed') &&
                        !cleanName.toLowerCase().includes('w/o manual') &&
                        !cleanName.toLowerCase().includes('without manual');
      }
      
      if (isValidProduct && cleanName.length > 3) {
        console.log(`Found valid product: "${cleanName}" - Price: ${price} - Manual: ${hasManual} - Boxed: ${hasBoxed}`);
        console.log(`Container text: "${containerText.substring(0, 200)}"`);
        console.log(`Price text: "${product.priceText || 'none'}"`);
        console.log(`Image URL: "${product.imageUrl || 'none'}"`);
        
        processedProducts.push({
          name: cleanName,
          price: price,
          url: productUrl,
          imageUrl: product.imageUrl || undefined,
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
