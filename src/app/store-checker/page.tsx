"use client";
import React, { useState, useEffect } from "react";
import { readSettings } from "@/lib/settings";

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
  const [customStore, setCustomStore] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StoreCheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [settings, setSettings] = useState<any>(null);

  // Category ID to name mapping
  const getCategoryName = (categoryId: string) => {
    const categoryMap: { [key: string]: string } = {
      // Retro categories
      "1037": "SNES Software",
      "1055": "Mega Drive Software", 
      "1052": "NES Software",
      "1030": "Game Boy Software",
      // Disc-based categories
      "1178": "PlayStation 2 Rarities",
      "403": "PlayStation 2 Software",
      "1192": "PlayStation 3 Software",
      "782": "PlayStation Software",
      "808": "Xbox 360 Software",
      "1064": "Xbox Software",
      "795": "GameCube Software"
    };
    return categoryMap[categoryId] || `Category ${categoryId}`;
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

  const addCustomStore = () => {
    if (customStore.trim()) {
      setSelectedStore(customStore.trim());
      setCustomStore("");
    }
  };

  const convertStoreNameForAPI = (storeName: string): string => {
    return storeName
      .toLowerCase()
      .replace(/-/g, '++')
      .replace(/\s+/g, '+');
  };

  const buildSearchUrl = (categoryId: string, storeName: string, page: number = 1) => {
    const baseUrl = "https://uk.webuy.com/search";
    const convertedStoreName = convertStoreNameForAPI(storeName);
    const params = new URLSearchParams({
      categoryIds: categoryId,
      sortBy: "prod_cex_uk_price_desc",
      stores: convertedStoreName,
      page: page.toString()
    });
    return `${baseUrl}?${params.toString()}`;
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
    
    try {
      const allResults: StoreCheckResult[] = [];
      const allCategories = [
        ...(settings.retroCategoryIds || []).map((id: string) => ({ id, name: "Retro Games", type: "retro" })),
        ...(settings.discBasedGameCategoryIds || []).map((id: string) => ({ id, name: "Disc Games", type: "disc" }))
      ];
      
      setProgress(`Checking store: ${selectedStore}`);
        
        const storeProducts: Product[] = [];
        
      for (const category of allCategories) {
        const categoryProducts = await scrapeStoreCategory(selectedStore, category.id, category.name);
        storeProducts.push(...categoryProducts);
        
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
    <div className="container">
 
      {/* Store Selection */}
      <div className="card" style={{ marginBottom: "24px" }}>
        {/* Store Selection */}
        <div style={{ marginBottom: "16px" }}>
          <h3>Select Store</h3>
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
        
        {/* Custom Store Input */}
        <div style={{ marginTop: "16px" }}>
          <h3>Add Custom Store</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={customStore}
              onChange={(e) => setCustomStore(e.target.value)}
              placeholder="Enter store name (e.g., Manchester)"
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                flex: 1,
                fontSize: "14px"
              }}
              onKeyPress={(e) => e.key === 'Enter' && addCustomStore()}
            />
            <button
              onClick={addCustomStore}
              style={{
                padding: "8px 16px",
                backgroundColor: "#e20a03",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
      
      {/* Check Button */}
      <div style={{ marginBottom: "24px" }}>
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
            fontWeight: "600"
          }}
        >
          {loading ? "Checking Store..." : "Check Store"}
        </button>
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
            <span className="muted">{progress}</span>
          </div>
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
                <table className="table">
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
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                              }}
                              onError={(e) => {
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
              ) : (
                <p className="muted">No products found for this store.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
