"use client";
import React, { useState, useEffect } from "react";
import { readSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";

interface ProductWithManual {
  productId: string;
  name: string;
  price: string;
  url: string;
  imageUrl?: string;
  store: string;
  categoryId: string;
}

// Category ID to name mapping
const categoryMap: { [key: string]: string } = {
  "1037": "SNES Software",
  "1055": "Mega Drive Software", 
  "1052": "NES Software"
};

export default function WhatsInStockPage() {
  const [products, setProducts] = useState<ProductWithManual[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    // Load settings on component mount
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const loadedSettings = await response.json();
          setSettings(loadedSettings);
        } else {
          console.error("Failed to load settings:", response.statusText);
          setError("Failed to load settings: " + response.statusText);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        setError("Failed to load settings: " + (error as Error).message);
      }
    };
    loadSettings();
  }, []);

  const buildSearchUrl = (categoryId: string, page: number = 1): string[] => {
    if (!settings) return [];
    
    const storesParam = settings.stores?.join("~") || "";
    
    // Build query parameters manually to avoid double encoding
    const queryParams = [
      `categoryIds=${categoryId}`,
      `sortBy=prod_cex_uk_price_desc`,
      `stores=${storesParam}`
    ];
    
    if (page > 1) {
      queryParams.push(`page=${page}`);
    }
    
    const queryString = queryParams.join('&');
    
    // Return multiple URL formats to try
    return [
      `${settings.searchUrl}/?${queryString}`, // With trailing slash (preferred)
      `${settings.searchUrl}?${queryString}`,  // Without trailing slash
      `https://uk.webuy.com/search/?${queryString}`, // Full URL with trailing slash
      `https://uk.webuy.com/search?${queryString}`   // Full URL without trailing slash
    ];
  };

  const scrapePage = async (urls: string[], categoryId: string): Promise<{ products: ProductWithManual[], hasNextPage: boolean }> => {
    let lastError: Error | null = null;
    let successfulUrl = "";
    
    // Try each URL until one works
    for (const url of urls) {
      try {
        console.log(`Trying URL via server-side API: ${url}`);
        
        // Use server-side API to bypass CORS
      const response = await fetch('/api/scrape-search-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, showAllProducts: false })
      });
        
        const result = await response.json();
        console.log(`Server-side response:`, result);
        
        if (!result.success) {
          // Return more detailed error information
          const errorDetails = {
            error: result.error || `Server-side request failed`,
            url: url,
            status: result.status,
            finalUrl: result.url,
            productsFound: result.products?.length || 0
          };
          console.error(`Server-side request failed:`, errorDetails);
          throw new Error(`Server error: ${result.error || 'Unknown error'} - URL: ${url}`);
        }
        
        const extractedProducts = result.products || []; // This is now the extracted products
        console.log(`Successfully received ${extractedProducts.length} products from URL: ${url}`);
        console.log(`Final response URL: ${result.url}`);
        console.log(`Total cards processed: ${result.totalCards || 0}`);
        console.log(`Processed cards: ${result.processedCards || 0}`);
        
        // Process the products directly from the API response
        console.log(`Products found:`, extractedProducts.map((p: any) => p.name));
        
        successfulUrl = url;
        
        // Convert extracted products to ProductWithManual format
        const products: ProductWithManual[] = [];
        
        console.log("Processing extracted products...");
        
        // Count products with manual indicators
        const manualIncludedCount = extractedProducts.filter((p: any) => p.hasManual).length;
        console.log(`Found ${manualIncludedCount} products with manual/boxed indicators`);
        
        // Process each extracted product
        for (const extractedProduct of extractedProducts) {
          // Only include products that have manual/boxed/complete indicators
          if (extractedProduct.hasManual) {
            const productId = extractedProduct.url 
              ? extractedProduct.url.split('id=')[1]?.split('&')[0] || `manual-${Date.now()}-${Math.random()}`
              : `manual-${Date.now()}-${Math.random()}`;
            
            products.push({
              productId: productId,
              name: extractedProduct.name,
              price: extractedProduct.price || "N/A",
              url: extractedProduct.url || "",
              imageUrl: extractedProduct.imageUrl || undefined,
              store: "Unknown",
              categoryId: categoryId
            });
          }
        }
        
        console.log(`Found ${products.length} products with manual/boxed indicators`);
        
        // For now, assume there might be more pages if we found products
        // This could be improved by checking the actual pagination in the response
        const hasNextPage = products.length > 0;
        
        console.log(`Found ${products.length} products, hasNextPage: ${hasNextPage}`);
        
        return { products, hasNextPage };
        
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`Error with URL ${url}:`, error);
        lastError = error as Error;
        
        // Continue to next URL
        continue;
      }
    }
    
    // If we get here, all URLs failed
    const errorMessage = `All URL attempts failed for category ${categoryId}. Last error: ${lastError?.message || 'Unknown error'}. Tried URLs: ${urls.join(', ')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  };

  const testUrlAccess = async () => {
    const testUrl = "https://uk.webuy.com/search/?categoryIds=1052&sortBy=prod_cex_uk_price_desc&stores=Boscombe~Bournemouth~Bournemouth+-+Castlepoint~Poole";
    console.log("Testing URL access via server-side API:", testUrl);
    
    try {
      const response = await fetch('/api/scrape-search-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: testUrl, showAllProducts: false })
      });
      
      const result = await response.json();
      console.log("Server-side test response:", result);
      
      if (result.success) {
        console.log("Test response status:", result.status);
        console.log("Test response products found:", result.products?.length || 0);
        console.log("Test response preview:", result.products?.slice(0, 3).map((p: any) => p.name) || "No products");
        return { success: true, status: result.status, url: result.url, productsFound: result.products?.length || 0 };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Test URL access failed:", error);
      return { success: false, error: (error as Error).message };
    }
  };

  const handleScanProducts = async () => {
    if (!settings || !settings.categoryIds) {
      setError("No categories configured");
      return;
    }
    
    // First, test URL access to debug the issue
    console.log("Testing URL access before scanning...");
    const testResult = await testUrlAccess();
    console.log("URL access test result:", testResult);
    
    if (!testResult.success) {
      setError(`URL access test failed: ${testResult.error}. This suggests a CORS or network issue.`);
      return;
    }
    
    setLoading(true);
    setProducts([]);
    setError(null);
    setCurrentPage(1);
    setProgress("Starting scan...");
    
    try {
      const allProducts: ProductWithManual[] = [];
      const totalCategories = settings.categoryIds.length;
      
      // Scan each category
      for (let categoryIndex = 0; categoryIndex < totalCategories; categoryIndex++) {
        const categoryId = settings.categoryIds[categoryIndex];
        setCurrentCategory(`Category ${categoryId}`);
        setProgress(`Scanning category ${categoryId} (${categoryIndex + 1}/${totalCategories})`);
        
        let page = 1;
        let hasNextPage = true;
        let categoryProducts: ProductWithManual[] = [];
        
        // Scan all pages for this category
        while (hasNextPage && page <= 5) { // Limit to 5 pages per category
          const urls = buildSearchUrl(categoryId, page);
          setProgress(`Scanning category ${categoryId}, page ${page}`);
          console.log(`Scanning category ${categoryId}, page ${page}: ${urls[0]} (and ${urls.length - 1} fallback URLs)`);
          
          try {
            const { products, hasNextPage: hasMore } = await scrapePage(urls, categoryId);
            categoryProducts.push(...products);
            
            setCurrentPage(page);
            
            if (!hasMore || products.length === 0) {
              hasNextPage = false;
            } else {
              page++;
              // Add delay between requests to be respectful
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (pageError) {
            console.error(`Error scanning category ${categoryId}, page ${page}:`, pageError);
            setError(`Error scanning category ${categoryId}, page ${page}: ${(pageError as Error).message}`);
            hasNextPage = false; // Skip to next category on error
          }
        }
        
        allProducts.push(...categoryProducts);
        console.log(`Category ${categoryId} completed: ${categoryProducts.length} products found`);
        
        // Add delay between categories
        if (categoryIndex < totalCategories - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      setProducts(allProducts);
      setProgress(`Scan completed! Found ${allProducts.length} products with manual included`);
      console.log(`Total products found: ${allProducts.length}`);
      
    } catch (error) {
      console.error("Failed to scan products:", error);
      setError(`Error: ${(error as Error).message}`);
      setProgress("Scan failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <main>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div 
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #f3f3f3",
                  borderTop: "2px solid #333",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}
              />
              <span className="muted">{progress}</span>
            </div>
          )}
        </div>
        
        {error && (
          <div style={{ 
            backgroundColor: "#f8d7da", 
            color: "#721c24", 
            padding: "12px", 
            borderRadius: "4px", 
            marginBottom: "16px" 
          }}>
            {error}
          </div>
        )}
        
        <div style={{ marginBottom: "16px" }}>
          <p className="muted" style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            <strong>Stores:</strong> {settings?.stores?.join(", ") || "None configured"}
          </p>
          {!loading && progress && (
            <p className="muted">
              <strong>Status:</strong> {progress}
            </p>
          )}
        </div>

        
        <div style={{ marginTop: "16px", textAlign: "left" }}>
          <button 
            onClick={handleScanProducts}
            disabled={loading || !settings}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: loading || !settings ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading || !settings ? "not-allowed" : "pointer",
              minWidth: "120px"
            }}
          >
            {loading ? "Scanning..." : "Find Games"}
          </button>
          
          {!settings && (
            <p className="muted" style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
              Loading settings...
            </p>
          )}
        </div>
        
        {products.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Product</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={`${product.productId}-${index}`}>
                    <td style={{ textAlign: "left" }}>{product.name.replace(/, (w\/|w\/o) Manual(, (Boxed|Unboxed))?.*$/, '').trim()}</td>
                    <td>{product.price}</td>
                    <td>{categoryMap[product.categoryId] || product.categoryId}</td>
                    <td>
                      <a href={product.url} target="_blank" rel="noreferrer">View Product</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ marginTop: "16px" }}>
              <p className="muted">
                <strong>Status:</strong> Scan completed! Found {products.length} products with manual included
              </p>
            </div>
          </div>
        )}
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </main>
  );
}
