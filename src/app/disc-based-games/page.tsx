"use client";
import React, { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";

interface DiscBasedGame {
  productId: string;
  name: string;
  price: string;
  url: string;
  imageUrl?: string;
  store: string;
  categoryId: string;
}

// Category ID to name mapping will be loaded from settings

export default function DiscBasedGamesPage() {
  // Helper function to get category name from settings
  const getCategoryName = (categoryId: string) => {
    if (!settings || !settings.categoryMap) {
      return categoryId;
    }
    return settings.categoryMap[categoryId] || categoryId;
  };
  const [products, setProducts] = useState<DiscBasedGame[]>([]);
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

  const buildSearchUrl = (categoryId: string, page: number = 1) => {
    if (!settings) return "";
    
    const selectedStoreGroupData = settings.stores?.find(group => group.name === selectedStoreGroup);
    const storeValues = selectedStoreGroupData?.values || [];
    const storesParam = storeValues.join("~");
    
    const baseUrl = settings.searchUrl || "https://uk.webuy.com/search";
    const params = new URLSearchParams({
      categoryIds: categoryId,
      sortBy: "prod_cex_uk_price_desc",
      stores: storesParam,
      page: page.toString()
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  const scrapePage = async (url: string): Promise<{ products: DiscBasedGame[], hasNextPage: boolean }> => {
    try {
      const response = await fetch('/api/scrape-search-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, showAllProducts: true })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Filter products to only include those over £20
      const filteredProducts = result.products.filter((product: any) => {
        const priceText = product.price || "";
        const priceMatch = priceText.match(/£(\d+(?:\.\d{2})?)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          return price > 20;
        }
        return false;
      });

      return {
        products: filteredProducts,
        hasNextPage: result.hasNextPage || false
      };
    } catch (error) {
      console.error("Scrape page error:", error);
      throw error;
    }
  };

  const handleScanProducts = async (categoryId: string) => {
    if (!settings) return;
    
    setLoading(true);
    setProducts([]);
    setError(null);
    setProgress("");
    setCurrentCategory(categoryId);
    setCurrentPage(1);
    setTotalPages(0);
    setCompletedPages(0);
    setSelectedCategory(categoryId);

    try {
      let allProducts: DiscBasedGame[] = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage && page <= 10) { // Limit to 10 pages for safety
        const url = buildSearchUrl(categoryId, page);
        setProgress(`Scanning page ${page} for ${getCategoryName(categoryId)}...`);
        
        const result = await scrapePage(url);
        // Filter products using disc-based games specific filter
        const filteredProducts = filterDiscBasedGames(result.products);
        allProducts = [...allProducts, ...filteredProducts];
        hasNextPage = result.hasNextPage;
        
        // Update progress tracking
        setCompletedPages(page);
        // If we have more pages, estimate total, otherwise we know the final count
        if (hasNextPage) {
          setTotalPages(Math.max(page + 1, 3)); // Estimate at least 3 pages
        } else {
          setTotalPages(page); // We know the final count
        }
        
        // Force a small delay to ensure state updates are processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update products in real-time
        setProducts([...allProducts]);
        
        if (hasNextPage) {
          page++;
          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Set final values
      setTotalPages(page - 1);
      setCompletedPages(page - 1);
      setProgress(`Scan completed! Found ${allProducts.length} disc-based games over £20`);
    } catch (error) {
      console.error("Scan products error:", error);
      setError("Failed to scan products: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getStoreNames = () => {
    if (!settings) return "";
    const selectedStoreGroupData = settings.stores?.find(group => group.name === selectedStoreGroup);
    return selectedStoreGroupData?.values.join(", ") || "";
  };

  // Filter function specifically for disc-based games
  const filterDiscBasedGames = (products: any[]) => {
    return products.filter((product: any) => {
      const priceText = product.price || "";
      const priceMatch = priceText.match(/£(\d+(?:\.\d{2})?)/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        // Only include games over £20 and exclude "No Manual" games
        return price > 20 && !product.name.toLowerCase().includes('no manual');
      }
      return false;
    });
  };

  // Clean product names for disc-based games display
  const cleanDiscBasedGameName = (name: string) => {
    return name
      .replace(/, \+ Manual.*$/, '') // Remove ", + Manual" and everything after
      .replace(/, No Manual.*$/, '') // Remove ", No Manual" and everything after
      .trim();
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {error && (
        <div style={{ 
          padding: "12px", 
          backgroundColor: "#fee", 
          border: "1px solid #fcc", 
          borderRadius: "4px", 
          marginBottom: "16px",
          color: "#c33"
        }}>
          {error}
        </div>
      )}

      {/* Progress Bar - Under Main Navigation Menu */}
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
              {progress} ({completedPages}{totalPages ? `/${totalPages}` : ''} pages completed)
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

      {settings && (
        <>
          {/* Store Selection */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {settings.stores?.map((storeGroup) => (
                  <button
                    key={storeGroup.name}
                    onClick={() => setSelectedStoreGroup(storeGroup.name)}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: selectedStoreGroup === storeGroup.name ? "#007bff" : "#fff",
                      color: selectedStoreGroup === storeGroup.name ? "#fff" : "#333",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    {storeGroup.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stores Info */}
          <div style={{ marginBottom: "16px", fontSize: "14px", color: "#666" }}>
            <strong>Stores:</strong> {getStoreNames()}
          </div>

          {/* Category Selection */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {settings.discBasedGameCategoryIds?.map((categoryId) => {
                  const categoryName = getCategoryName(categoryId);
                  return (
                    <button
                      key={categoryId}
                      onClick={() => handleScanProducts(categoryId)}
                      disabled={loading}
                      style={{
                        padding: "8px 16px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: selectedCategory === categoryId ? "#28a745" : "#fff",
                        color: selectedCategory === categoryId ? "#fff" : "#333",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {categoryName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>


          {/* Results */}
          {products.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <table className="table">
                     <thead>
                       <tr>
                         <th></th>
                         <th>Product</th>
                         <th>Price ↓</th>
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
                      <td>{cleanDiscBasedGameName(product.name)}</td>
                      <td style={{ 
                        textAlign: "center",
                        fontWeight: "bold",
                        color: "#28a745"
                      }}>
                        {product.price}
                      </td>
                      <td>
                        <a 
                          href={product.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          View Game
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="muted" style={{ marginTop: "16px", fontSize: "14px" }}>
                Found {products.length} disc-based games over £20
              </div>
            </div>
          )}

        </>
      )}


      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
