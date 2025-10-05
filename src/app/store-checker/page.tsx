"use client";
import React, { useState, useEffect } from "react";

interface Store {
  name: string;
  values: string[];
}

interface Product {
  name: string;
  price: string;
  url: string;
  imageUrl?: string;
  store: string;
  categoryId: string;
  hasManual: boolean;
  hasBoxed: boolean;
  isUnboxed: boolean;
  hasNoManual: boolean;
  productId: string;
}

interface StoreCheckResult {
  store: string;
  products: Product[];
  totalFound: number;
  retroGames: number;
  discGames: number;
}

export default function StoreCheckerPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StoreCheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [settings, setSettings] = useState<any>(null);
  const [completedCategories, setCompletedCategories] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);

  // Category ID to name mapping
  const getCategoryName = (categoryId: string) => {
    if (!settings || !settings.categoryMap) {
      return `Category ${categoryId}`;
    }
    return settings.categoryMap[categoryId] || `Category ${categoryId}`;
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const loadedSettings = await response.json();
          setSettings(loadedSettings);
          setStores(loadedSettings.stores || []);
        } else {
          console.error("Failed to load settings:", response.statusText);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  const convertStoreNameForAPI = (storeName: string): string => {
    const result = storeName
      .replace(/\s*-\s*/g, '+-+')  // Replace hyphen with optional spaces around it
      .replace(/\s+/g, '+');       // Replace remaining spaces with +
    return result;
  };

  const filterProductName = (productName: string): string => {
    return productName
      .replace(/,\s*\+?\s*Manual\s*,?\s*Boxed\s*,?\s*$/i, '')  // Remove ", + Manual, Boxed" or ", Manual, Boxed" with optional trailing comma
      .replace(/,\s*\+?\s*Manual\s*,?\s*$/i, '')                // Remove ", + Manual" or ", Manual" with optional trailing comma
      .replace(/,\s*w\/\s*Manual\s*,?\s*Boxed\s*,?\s*$/i, '')   // Remove ", w/ Manual, Boxed" with optional trailing comma
      .replace(/,\s*w\/\s*Manual\s*,?\s*$/i, '')                // Remove ", w/ Manual" with optional trailing comma
      .replace(/,\s*Boxed\s*,?\s*$/i, '')                       // Remove ", Boxed" with optional trailing comma
      .replace(/,\s*$/, '')                                     // Remove any remaining trailing comma
      .trim();                                                  // Remove leading/trailing whitespace
  };

  const buildSearchUrl = (categoryId: string, storeName: string, page: number = 1) => {
    const baseUrl = "https://uk.webuy.com/search";
    const convertedStoreName = convertStoreNameForAPI(storeName);
    return `${baseUrl}?categoryIds=${categoryId}&sortBy=prod_cex_uk_price_desc&stores=${convertedStoreName}&page=${page}`;
  };

  const scrapeStoreCategory = async (store: string, categoryId: string, categoryName: string): Promise<Product[]> => {
    try {
      const url = buildSearchUrl(categoryId, store);
      console.log(`Scraping ${store} - ${categoryName}: ${url}`);
      
      const response = await fetch('/api/scrape-search-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, showAllProducts: true })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error(`Failed to scrape ${store} - ${categoryName}:`, result.error);
        return [];
      }
      
      const products: Product[] = [];
      
      for (const extractedProduct of result.products || []) {
        const hasManual = extractedProduct.hasManual || false;
        const hasBoxed = extractedProduct.hasBoxed || false;
        const isUnboxed = extractedProduct.isUnboxed || false;
        const hasNoManual = extractedProduct.hasNoManual || false;
        
        // Extract price as number for filtering
        const priceText = extractedProduct.price || "N/A";
        const priceMatch = priceText.match(/£([0-9]+\.?[0-9]*)/);
        const priceValue = priceMatch ? parseFloat(priceMatch[1]) : 0;
        
        // Apply filtering based on category type
        let isValidProduct = false;
        
        if (settings?.retroCategoryIds?.includes(categoryId)) {
          // Retro games: must have manual AND be boxed
          isValidProduct = hasManual && hasBoxed && !isUnboxed && !hasNoManual;
        } else if (settings?.discBasedGameCategoryIds?.includes(categoryId)) {
          // Disc-based games: price must be over £20
          isValidProduct = priceValue > 20;
        }
        
        if (isValidProduct) {
          products.push({
            name: extractedProduct.name,
            price: extractedProduct.price || "N/A",
            url: extractedProduct.url || "",
            imageUrl: extractedProduct.imageUrl || undefined,
            store: store,
            categoryId: categoryId,
            hasManual: hasManual,
            hasBoxed: hasBoxed,
            isUnboxed: isUnboxed,
            hasNoManual: hasNoManual,
            productId: extractedProduct.productId || `product-${Date.now()}-${Math.random()}`
          });
        }
      }
      
      return products;
    } catch (error) {
      console.error(`Error scraping ${store} - ${categoryName}:`, error);
      return [];
    }
  };

  const checkStores = async () => {
    if (!settings || !selectedStore) {
      setError("Please select a store");
      return;
    }
    
    setLoading(true);
    setResults([]);
    setError(null);
    setProgress("Starting store check...");
    setCompletedCategories(0);

    try {
      const allResults: StoreCheckResult[] = [];
      const allCategories = [
        ...(settings.retroCategoryIds || []).map((id: string) => ({ id, name: "Retro Games", type: "retro" })),
        ...(settings.discBasedGameCategoryIds || []).map((id: string) => ({ id, name: "Disc Games", type: "disc" }))
      ];
      
      setTotalCategories(allCategories.length);
      setProgress(`Checking store: ${selectedStore}`);
        
      const storeProducts: Product[] = [];
        
      for (let i = 0; i < allCategories.length; i++) {
        const category = allCategories[i];
        setProgress(`Checking ${category.name} (${i + 1}/${allCategories.length})...`);
        
        const categoryProducts = await scrapeStoreCategory(selectedStore, category.id, category.name);
        storeProducts.push(...categoryProducts);
        
        setCompletedCategories(i + 1);
        
        // Small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Deduplicate products by productId
      const uniqueProducts = storeProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.productId === product.productId)
      );
      
      // Sort by price (highest first)
      const sortedProducts = uniqueProducts.sort((a, b) => {
        const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
        const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
        return priceB - priceA;
      });
      
      const retroCount = sortedProducts.filter(p => settings.retroCategoryIds?.includes(p.categoryId)).length;
      const discCount = sortedProducts.filter(p => settings.discBasedGameCategoryIds?.includes(p.categoryId)).length;
      
      allResults.push({
        store: selectedStore,
        products: sortedProducts,
        totalFound: sortedProducts.length,
        retroGames: retroCount,
        discGames: discCount
      });
      
      // Update results in real-time
      setResults([...allResults]);
      
      setProgress(`Store check completed! Found ${allResults[0]?.totalFound || 0} products`);
      
    } catch (error) {
      console.error("Store check failed:", error);
      setError(`Error: ${(error as Error).message}`);
      setProgress("Store check failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Store Selection and Check Button */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div style={{ 
          display: "flex", 
          gap: "16px", 
          alignItems: "flex-end",
          marginTop: "16px"
        }}>
          {/* Store Selection */}
          <div style={{ flex: "0 0 75%" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontSize: "14px", 
              fontWeight: "500" 
            }}>
              Select Store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                backgroundColor: "#fff"
              }}
            >
              <option value="">-- Select a store --</option>
              {settings?.allStores && Object.keys(settings.allStores)
                .sort((a, b) => a.localeCompare(b))
                .map((storeName) => (
                  <option key={storeName} value={storeName}>
                    {storeName}
                  </option>
                ))
              }
            </select>
          </div>
          
          {/* Check Button */}
          <button
            onClick={checkStores}
            disabled={loading || !selectedStore}
            style={{
              padding: "12px 24px",
              backgroundColor: loading || !selectedStore ? "#ccc" : "#e20a03",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: loading || !selectedStore ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600",
              whiteSpace: "nowrap"
            }}
          >
            {loading ? "Checking Store..." : "Check Store"}
          </button>
        </div>
      </div>
      
      {/* Progress */}
      {loading && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
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
              {progress} ({completedCategories}{totalCategories ? `/${totalCategories}` : ''} categories completed)
            </span>
          </div>
          {totalCategories && totalCategories > 0 && (
            <div style={{ 
              width: "100%", 
              height: "4px", 
              backgroundColor: "#f0f0f0", 
              borderRadius: "2px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${(completedCategories / totalCategories) * 100}%`,
                height: "100%",
                backgroundColor: "#007bff",
                transition: "width 0.3s ease"
              }} />
            </div>
          )}
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div style={{ 
          padding: "12px", 
          backgroundColor: "#f8d7da", 
          color: "#721c24", 
          border: "1px solid #f5c6cb", 
          borderRadius: "4px", 
          marginBottom: "24px" 
        }}>
          {error}
        </div>
      )}
      
      {/* Results */}
      {results.length > 0 && (
        <div>
          <h2>Store Results</h2>
          {results.map((result, index) => (
            <div key={index} className="card" style={{ marginBottom: "24px" }}>
              <h3>
                {result.store} 
                <span style={{ fontSize: "14px", fontWeight: "400", color: "#666", marginLeft: "8px" }}>
                  ({result.totalFound} products - {result.retroGames} retro, {result.discGames} disc)
                </span>
              </h3>
              
              {result.products.length > 0 ? (
                <div>
                  {/* In Stock Products */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#28a745" }}>
                      ✅ In Stock ({result.products.length})
                    </h4>
                    <table className="table" key={`in-stock-table-${settings?.categoryMap ? 'loaded' : 'loading'}`}>
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Name</th>
                          <th>Price</th>
                          <th>Category</th>
                          <th>Product</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.products.map((product) => (
                          <tr key={product.productId}>
                            <td>
                              {product.imageUrl ? (
                                <img 
                                  src={`/api/image-proxy?url=${encodeURIComponent(product.imageUrl)}`}
                                  alt={product.name || 'Product'} 
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    objectFit: 'cover',
                                    borderRadius: '4px'
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: '#f0f0f0',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  color: '#666'
                                }}>
                                  No Image
                                </div>
                              )}
                            </td>
                            <td>{product.name}</td>
                            <td>{product.price}</td>
                            <td>{getCategoryName(product.categoryId)}</td>
                            <td>
                              <a href={product.url} target="_blank" rel="noreferrer">Open</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Out of Stock Products - Currently empty but structure ready */}
                  <div>
                    <h4 style={{ margin: "0 0 12px 0", color: "#dc3545" }}>
                      ❌ Out of Stock (0)
                    </h4>
                    <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                      No out of stock products detected. All found products are currently in stock at this store.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {/* In Stock Products */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#28a745" }}>
                      ✅ In Stock (0)
                    </h4>
                    <p className="muted">No products found for this store.</p>
                  </div>

                  {/* Out of Stock Products */}
                  <div>
                    <h4 style={{ margin: "0 0 12px 0", color: "#dc3545" }}>
                      ❌ Out of Stock (0)
                    </h4>
                    <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                      No products checked for this store.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}