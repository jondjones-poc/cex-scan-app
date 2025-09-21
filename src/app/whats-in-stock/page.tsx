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
  "1037": "SNES",
  "1055": "Mega Drive", 
  "1052": "NES",
  "1030": "N64",
};

export default function WhatsInStockPage() {
  const [products, setProducts] = useState<ProductWithManual[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [completedPages, setCompletedPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [selectedStoreGroup, setSelectedStoreGroup] = useState<string>("Home");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

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
    
    // Find the selected store group
    const selectedGroup = settings.stores?.find((group) => group.name === selectedStoreGroup);
    const storesParam = selectedGroup?.values?.join("~") || "";
    
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
        
        // Process each extracted product with filtering logic
        for (const extractedProduct of extractedProducts) {
          // Apply "What's in Stock" filtering logic: must have manual AND be boxed AND not unboxed AND not "no manual"
          const hasManual = extractedProduct.hasManual || false;
          const hasBoxed = extractedProduct.hasBoxed || false;
          const isUnboxed = extractedProduct.isUnboxed || false;
          const hasNoManual = extractedProduct.hasNoManual || false;
          
          // What's in Stock filtering: require manual AND boxed, exclude unboxed and no manual
          const isValidForWhatsInStock = hasManual && hasBoxed && !isUnboxed && !hasNoManual;
          
          if (isValidForWhatsInStock) {
            products.push({
              productId: extractedProduct.productId || `product-${Date.now()}-${Math.random()}`,
              name: extractedProduct.name,
              price: extractedProduct.price || "N/A",
              url: extractedProduct.url || "",
              imageUrl: extractedProduct.imageUrl || undefined,
              store: "Unknown",
              categoryId: categoryId
            });
          }
        }
        
        console.log(`Found ${products.length} products with manual/boxed indicators after filtering`);
        
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


  const handleScanAllCategories = async () => {
    if (!settings || !settings.retroCategoryIds) {
      setError("No categories configured");
      return;
    }
    
    setLoading(true);
    setProducts([]);
    setError(null);
    setCurrentPage(1);
    setTotalPages(0);
    setCompletedPages(0);
    setProgress("Starting scan of all categories...");
    setSelectedCategory(""); // Clear selected category for "All" mode
    
    try {
      const allProducts: ProductWithManual[] = [];
      const totalCategories = settings.retroCategoryIds.length;
      let completedCategories = 0;
      
      setCurrentCategory("All Categories");
      
      // Scan each category
      for (const categoryId of settings.retroCategoryIds) {
        const categoryName = categoryMap[categoryId] || `Category ${categoryId}`;
        setProgress(`Scanning ${categoryName} (${completedCategories + 1}/${totalCategories})...`);
        
        let page = 1;
        let hasNextPage = true;
        let categoryProducts: ProductWithManual[] = [];
        
        // Scan all pages for this category
        while (hasNextPage && page <= 5) { // Limit to 5 pages per category
          const urls = buildSearchUrl(categoryId, page);
          setProgress(`Scanning ${categoryName}, page ${page} (${completedCategories + 1}/${totalCategories})`);
          
          try {
            const { products, hasNextPage: hasMore } = await scrapePage(urls, categoryId);
            categoryProducts.push(...products);
            
            // Deduplicate products based on productId
            const uniqueCategoryProducts = categoryProducts.filter((product, index, self) => 
              index === self.findIndex(p => p.productId === product.productId)
            );
            categoryProducts.length = 0;
            categoryProducts.push(...uniqueCategoryProducts);
            
            // Update products in real-time with all categories combined
            const updatedProducts = [...allProducts, ...categoryProducts];
            const sortedProducts = updatedProducts.sort((a: ProductWithManual, b: ProductWithManual) => {
              const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
              const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
              return priceB - priceA; // Highest price first
            });
            setProducts(sortedProducts);
            
            setProgress(`Found ${sortedProducts.length} products so far... (${categoryName}, page ${page})`);
            
            if (!hasMore || products.length === 0) {
              hasNextPage = false;
            } else {
              page++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (pageError) {
            console.error(`Error scanning ${categoryName}, page ${page}:`, pageError);
            setError(`Error scanning ${categoryName}, page ${page}: ${(pageError as Error).message}`);
            hasNextPage = false;
          }
        }
        
        allProducts.push(...categoryProducts);
        completedCategories++;
        setCompletedPages(completedCategories);
        setTotalPages(totalCategories);
        
        console.log(`${categoryName} completed: ${categoryProducts.length} products found`);
        
        // Small delay between categories
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Final deduplication across all products
      const finalUniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.productId === product.productId)
      );
      
      // Final sort by price (highest first)
      const finalSortedProducts = finalUniqueProducts.sort((a: ProductWithManual, b: ProductWithManual) => {
        const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
        const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
        return priceB - priceA;
      });
      
      setProducts(finalSortedProducts);
      setProgress(`Scan completed! Found ${finalSortedProducts.length} products across all categories`);
      console.log(`Total products found across all categories: ${finalSortedProducts.length}`);
      
    } catch (error) {
      console.error("Failed to scan all categories:", error);
      setError(`Error: ${(error as Error).message}`);
      setProgress("Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const handleScanProducts = async (categoryId?: string) => {
    const targetCategoryId = categoryId || selectedCategory;
    
    if (!settings || !settings.retroCategoryIds) {
      setError("No categories configured");
      return;
    }
    
    if (!targetCategoryId) {
      setError("Please select a category to scan");
      return;
    }
    
    setLoading(true);
    setProducts([]);
    setError(null);
    setCurrentPage(1);
    setTotalPages(0);
    setCompletedPages(0);
    setProgress("Starting scan...");
    
    try {
      const allProducts: ProductWithManual[] = [];
      const categoryName = categoryMap[targetCategoryId] || `Category ${targetCategoryId}`;
      
      setCurrentCategory(categoryName);
      setProgress(`Scanning ${categoryName}...`);
      
      let page = 1;
      let hasNextPage = true;
      let categoryProducts: ProductWithManual[] = [];
      
      // Scan all pages for this category
      while (hasNextPage && page <= 5) { // Limit to 5 pages per category
        const urls = buildSearchUrl(targetCategoryId, page);
        setProgress(`Scanning ${categoryName}, page ${page}`);
        console.log(`Scanning ${categoryName} (${targetCategoryId}), page ${page}: ${urls[0]} (and ${urls.length - 1} fallback URLs)`);
        
        try {
          const { products, hasNextPage: hasMore } = await scrapePage(urls, targetCategoryId);
          categoryProducts.push(...products);
          
          // Deduplicate products based on productId
          const uniqueCategoryProducts = categoryProducts.filter((product, index, self) => 
            index === self.findIndex(p => p.productId === product.productId)
          );
          categoryProducts.length = 0; // Clear array
          categoryProducts.push(...uniqueCategoryProducts); // Add back unique products
          
          // Update products in real-time
          const updatedProducts = [...allProducts, ...categoryProducts];
          const sortedProducts = updatedProducts.sort((a: ProductWithManual, b: ProductWithManual) => {
            const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
            const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
            return priceB - priceA;
          });
          setProducts(sortedProducts);
          
          setCurrentPage(page);
          setProgress(`Found ${sortedProducts.length} products so far... (Page ${page})`);
          
          // Update progress tracking
          setCompletedPages(page);
          if (hasMore && products.length > 0) {
            setTotalPages(Math.max(page + 1, 3)); // Estimate at least 3 pages
          } else {
            setTotalPages(page); // We know the final count
          }
          
          if (!hasMore || products.length === 0) {
            hasNextPage = false;
          } else {
            page++;
            // Reduced delay between requests for faster scanning
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (pageError) {
          console.error(`Error scanning ${categoryName}, page ${page}:`, pageError);
          setError(`Error scanning ${categoryName}, page ${page}: ${(pageError as Error).message}`);
          hasNextPage = false; // Stop scanning on error
        }
      }
      
      allProducts.push(...categoryProducts);
      console.log(`${categoryName} completed: ${categoryProducts.length} products found`);
      
      // Final deduplication across all products
      const finalUniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.productId === product.productId)
      );
      
      // Final sort and update
      const finalSortedProducts = finalUniqueProducts.sort((a: ProductWithManual, b: ProductWithManual) => {
        const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
        const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
        return priceB - priceA;
      });
      
      setProducts(finalSortedProducts);
      setTotalPages(page - 1);
      setCompletedPages(page - 1);
      setProgress(`Scan completed! Found ${finalSortedProducts.length} products with manual included`);
      console.log(`Total products found: ${finalSortedProducts.length}`);
      
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
        {/* Progress Bar */}
        {loading && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 8 }}>
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
              <span className="muted">
                {progress} ({currentCategory === "All Categories" ? `${completedPages}/${totalPages} categories` : `${completedPages}${totalPages ? `/${totalPages}` : ''} pages`} completed)
              </span>
            </div>
            <div style={{ 
              width: "100%", 
              height: "4px", 
              backgroundColor: "#f0f0f0", 
              borderRadius: "2px",
              overflow: "hidden"
            }}>
              <div style={{
                width: totalPages > 0 ? `${(completedPages / totalPages) * 100}%` : `${Math.min(completedPages * 20, 90)}%`,
                height: "100%",
                backgroundColor: "#007bff",
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>
        )}
        
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
        
        {settings && (
          <>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {settings?.stores?.map((storeGroup) => (
                <button
                  key={storeGroup.name}
                  onClick={() => setSelectedStoreGroup(storeGroup.name)}
                  style={{
                    padding: "8px 12px",
                    border: selectedStoreGroup === storeGroup.name ? "2px solid #0070f3" : "1px solid #ccc",
                    borderRadius: "4px",
                    backgroundColor: selectedStoreGroup === storeGroup.name ? "#0070f3" : "#fff",
                    color: selectedStoreGroup === storeGroup.name ? "#fff" : "#000",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: selectedStoreGroup === storeGroup.name ? "bold" : "normal"
                  }}
                >
                  {storeGroup.name}
                </button>
              ))}
            </div>
          </div>
          <p className="muted" style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            <strong>Selected Stores:</strong> {settings?.stores?.find((group) => group.name === selectedStoreGroup)?.values?.join(", ") || "None configured"}
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {/* All button */}
              <button
                onClick={handleScanAllCategories}
                disabled={loading}
                style={{
                  padding: "8px 12px",
                  border: selectedCategory === "" && currentCategory === "All Categories" ? "2px solid #dc3545" : "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: selectedCategory === "" && currentCategory === "All Categories" ? "#dc3545" : "#fff",
                  color: selectedCategory === "" && currentCategory === "All Categories" ? "#fff" : "#000",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: selectedCategory === "" && currentCategory === "All Categories" ? "bold" : "normal",
                  opacity: loading ? 0.6 : 1
                }}
              >
                All
              </button>
              
              {/* Individual category buttons */}
              {settings?.retroCategoryIds?.map((categoryId) => {
                const categoryName = categoryMap[categoryId] || `Category ${categoryId}`;
                return (
                  <button
                    key={categoryId}
                    onClick={() => {
                      setSelectedCategory(categoryId);
                      handleScanProducts(categoryId);
                    }}
                    disabled={loading}
                    style={{
                      padding: "8px 12px",
                      border: selectedCategory === categoryId ? "2px solid #28a745" : "1px solid #ccc",
                      borderRadius: "4px",
                      backgroundColor: selectedCategory === categoryId ? "#28a745" : "#fff",
                      color: selectedCategory === categoryId ? "#fff" : "#000",
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: selectedCategory === categoryId ? "bold" : "normal",
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {categoryName}
                  </button>
                );
              })}
            </div>
          </div>
          {!loading && progress && (
            <p className="muted">
              <strong>Status:</strong> {progress}
            </p>
          )}
        </div>
          </>
        )}

        {!settings && (
            <p className="muted" style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
              Loading settings...
            </p>
          )}
        
        {products.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th style={{ textAlign: "left" }}>Product</th>
                  <th>Price ↓</th>
                  <th>Category</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={`${product.productId}-${index}`}>
                    <td>
                      {product.imageUrl ? (
                        <img 
                          src={`/api/image-proxy?url=${encodeURIComponent(product.imageUrl)}`}
                          alt={product.name || 'Product'} 
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                          onError={(e) => {
                            // Hide image if it fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: '#f0f0f0',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          No img
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "left" }}>{product.name.replace(/, (w\/|w\/o) Manual(, (Boxed|Unboxed))?.*$/, '').trim()}</td>
                    <td>{product.price}</td>
                    <td>{categoryMap[product.categoryId] || product.categoryId}</td>
                    <td>
                      <a href={product.url} target="_blank" rel="noreferrer">View Game</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ marginTop: "16px" }}>
              <p className="muted">
                <strong>Status:</strong> {currentCategory === "All Categories" ? `Scan completed! Found ${products.length} products across all categories with manual included` : `Scan completed! Found ${products.length} products with manual included`}
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
