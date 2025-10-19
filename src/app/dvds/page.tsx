"use client";
import React, { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";

interface DVD {
  productId: string;
  name: string;
  price: string;
  url: string;
  imageUrl?: string;
  store: string;
  categoryId: string;
}

// Category ID to name mapping will be loaded from settings

export default function DVDsPage() {
  // Helper function to get category name from settings
  const getCategoryName = (categoryId: string) => {
    if (!settings || !settings.categoryMap) {
      return categoryId;
    }
    return settings.categoryMap[categoryId] || categoryId;
  };
  const [products, setProducts] = useState<DVD[]>([]);
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
  const [scanMode, setScanMode] = useState<'quick' | 'full'>('quick');
  const [showSearchButton, setShowSearchButton] = useState<boolean>(true);

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

  const scrapePage = async (url: string): Promise<{ products: DVD[], hasNextPage: boolean }> => {
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

      // For DVDs, we don't need price filtering like disc-based games
      const dvdProducts: DVD[] = result.products.map((product: any) => ({
        productId: product.productId || "",
        name: product.name || "",
        price: product.price || "",
        url: product.url || "",
        imageUrl: product.imageUrl || "",
        store: product.store || "",
        categoryId: product.categoryId || ""
      }));

      return {
        products: dvdProducts,
        hasNextPage: result.hasNextPage || false
      };
    } catch (error) {
      console.error('Error scraping page:', error);
      throw error;
    }
  };

  const handleScanAllCategories = async () => {
    if (!settings || !settings.dvdCategoryIds) {
      setError("No DVD categories configured");
      return;
    }

    setLoading(true);
    setError(null);
    setProducts([]);
    setProgress("Starting scan of all DVD categories...");
    setCompletedPages(0);
    setTotalPages(settings.dvdCategoryIds.length);

    try {
      const allProducts: DVD[] = [];

      for (let i = 0; i < settings.dvdCategoryIds.length; i++) {
        const categoryId = settings.dvdCategoryIds[i];
        const categoryName = getCategoryName(categoryId);
        
        setProgress(`Scanning ${categoryName} (${i + 1}/${settings.dvdCategoryIds.length})...`);
        setCurrentCategory(categoryName);

        try {
          const url = buildSearchUrl(categoryId, 1);
          const result = await scrapePage(url);
          
          // Add category info to products
          const productsWithCategory = result.products.map(product => ({
            ...product,
            categoryId: categoryId
          }));
          
          allProducts.push(...productsWithCategory);
          setCompletedPages(i + 1);
        } catch (error) {
          console.error(`Error scanning category ${categoryName}:`, error);
          // Continue with next category
        }
      }

      // Sort by price (highest first)
      allProducts.sort((a, b) => {
        const priceA = parseFloat(a.price.replace(/[£,]/g, '')) || 0;
        const priceB = parseFloat(b.price.replace(/[£,]/g, '')) || 0;
        return priceB - priceA;
      });

      setProducts(allProducts);
      setProgress(`Scan completed! Found ${allProducts.length} DVDs across all categories.`);
    } catch (error) {
      console.error('Error during scan:', error);
      setError("Scan failed: " + (error as Error).message);
    } finally {
      setLoading(false);
      setShowSearchButton(true); // Show search button again when search completes
    }
  };

  const handleScanHorrorCategory = async () => {
    if (!settings) return;

    setLoading(true);
    setError(null);
    setProducts([]);
    setSelectedCategory("horror");
    setCurrentPage(1);
    setCompletedPages(0);
    setTotalPages(0);

    setProgress("Scanning Horror DVDs...");
    setCurrentCategory("Horror");

    try {
      // Build the Horror DVD URL with the special format
      const storeGroup = settings.stores?.find(group => group.name === selectedStoreGroup);
      if (!storeGroup) {
        throw new Error("Store group not found");
      }

      const storeValues = storeGroup.values.join("~");
      const horrorUrl = `https://uk.webuy.com/search?productLineId=6&productLineName=DVD&sortBy=prod_cex_uk_price_desc&categoryFriendlyName=DVD+Movies&Genre=Horror&stores=${storeValues}`;
      
      console.log("Scraping Horror DVDs with URL:", horrorUrl);
      
      const response = await fetch('/api/scrape-dvd-horror', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: horrorUrl,
          showAllProducts: scanMode === 'full'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Add store and category info to products
      const productsWithInfo = result.products.map((product: any) => ({
        ...product,
        store: storeGroup.values.join(", "),
        categoryId: "horror"
      }));

      setProducts(productsWithInfo);
      setProgress(`Scan completed! Found ${productsWithInfo.length} Horror DVDs`);
      
    } catch (error) {
      console.error("Horror scan error:", error);
      setError("Horror scan failed: " + (error as Error).message);
    } finally {
      setLoading(false);
      setShowSearchButton(true); // Show search button again when search completes
    }
  };

  const handleCategoryClick = async (categoryId: string) => {
    if (!settings) return;

    setLoading(true);
    setError(null);
    setProducts([]);
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    setCompletedPages(0);
    setTotalPages(0);

    const categoryName = getCategoryName(categoryId);
    setProgress(`Scanning ${categoryName}...`);
    setCurrentCategory(categoryName);

    try {
      const url = buildSearchUrl(categoryId, 1);
      const result = await scrapePage(url);
      
      // Add category info to products
      const productsWithCategory = result.products.map(product => ({
        ...product,
        categoryId: categoryId
      }));

      setProducts(productsWithCategory);
      setProgress(`Found ${productsWithCategory.length} DVDs in ${categoryName}`);
    } catch (error) {
      console.error('Error scanning category:', error);
      setError("Scan failed: " + (error as Error).message);
    } finally {
      setLoading(false);
      setShowSearchButton(true); // Show search button again when search completes
    }
  };

  return (
    <div style={{ backgroundColor: "#0a0a0a", minHeight: "100vh", padding: "20px" }}>
      {error && (
        <div style={{ 
          padding: "16px", 
          backgroundColor: "rgba(255, 50, 50, 0.1)", 
          border: "1px solid rgba(255, 50, 50, 0.3)", 
          borderRadius: "8px", 
          marginBottom: "24px",
          color: "#ff6b6b",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}

      {/* Quick/Full Mode Toggle - Top Center */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}>
        <div 
          onClick={() => !loading && setScanMode(scanMode === 'quick' ? 'full' : 'quick')}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px",
            backgroundColor: "rgba(0, 255, 255, 0.08)",
            border: "2px solid rgba(0, 255, 255, 0.25)",
            borderRadius: "20px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            opacity: loading ? 0.6 : 1,
            boxShadow: "0 2px 8px rgba(0, 255, 255, 0.15)",
            flexShrink: 0
          }}
        >
          <div style={{
            padding: "6px 14px",
            borderRadius: "16px",
            fontSize: "13px",
            fontWeight: "600",
            transition: "all 0.3s ease",
            backgroundColor: scanMode === 'quick' ? "rgba(0, 255, 255, 0.9)" : "transparent",
            color: scanMode === 'quick' ? "#ffffff" : "rgba(0, 255, 255, 0.9)",
            boxShadow: scanMode === 'quick' ? "0 2px 6px rgba(0, 255, 255, 0.3)" : "none"
          }}>
            🎧 Quick
          </div>
          <div style={{
            padding: "6px 14px",
            borderRadius: "16px",
            fontSize: "13px",
            fontWeight: "600",
            transition: "all 0.3s ease",
            backgroundColor: scanMode === 'full' ? "rgba(0, 255, 255, 0.9)" : "transparent",
            color: scanMode === 'full' ? "#ffffff" : "rgba(0, 255, 255, 0.9)",
            boxShadow: scanMode === 'full' ? "0 2px 6px rgba(0, 255, 255, 0.3)" : "none"
          }}>
            👾 Full
          </div>
        </div>
      </div>

      {/* Store Selection - 50% width buttons */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }} className="store-buttons-container">
          {!settings ? (
            <div style={{ color: "#a0a0a0", fontSize: "14px", padding: "20px", textAlign: "center", width: "100%" }}>
              Loading store options...
            </div>
          ) : settings.stores && settings.stores.length > 0 ? settings.stores.map((storeGroup) => {
            const isSelected = selectedStoreGroup === storeGroup.name;
            return (
              <button
                key={storeGroup.name}
                onClick={() => setSelectedStoreGroup(storeGroup.name)}
                style={{
                  flex: "1",
                  minWidth: "calc(50% - 4px)",
                  padding: "14px 20px",
                  border: isSelected ? "3px solid rgba(0, 255, 255, 0.8)" : "none",
                  borderRadius: "8px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: isSelected 
                    ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 6px 20px rgba(0, 255, 255, 0.5)" 
                    : "0 4px 15px rgba(0, 255, 255, 0.3)",
                  transition: "all 0.3s ease",
                  transform: isSelected ? "scale(1.05)" : "scale(1)"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#2a2a3e";
                  e.currentTarget.style.boxShadow = isSelected 
                    ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 6px 20px rgba(0, 255, 255, 0.5)"
                    : "0 6px 20px rgba(0, 255, 255, 0.5)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#1a1a2e";
                  e.currentTarget.style.boxShadow = isSelected 
                    ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 6px 20px rgba(0, 255, 255, 0.5)" 
                    : "0 4px 15px rgba(0, 255, 255, 0.3)";
                  e.currentTarget.style.transform = isSelected ? "scale(1.05)" : "scale(1)";
                }}
              >
                {storeGroup.name === 'Home' ? '🎮' : storeGroup.name === 'London' ? '🎧' : storeGroup.name === 'Near home' ? '🕹️' : '🧑‍💻'} {storeGroup.name}
              </button>
            );
          }) : (
            <div style={{ color: "#a0a0a0", fontSize: "14px", padding: "20px", textAlign: "center", width: "100%" }}>
              No store options available
            </div>
          )}
        </div>
      </div>

      {/* Category Selection */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ marginBottom: "12px" }}>
          <select
            value={selectedCategory}
            onChange={(e) => {
              const newCategory = e.target.value;
              setSelectedCategory(newCategory);
              setShowSearchButton(false); // Hide search button when dropdown changes
              if (newCategory === "") {
                handleScanAllCategories();
              } else if (newCategory === "horror") {
                handleScanHorrorCategory();
              } else {
                handleCategoryClick(newCategory);
              }
            }}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              fontSize: "16px",
              border: "2px solid rgba(0, 255, 255, 0.3)",
              borderRadius: "8px",
              backgroundColor: "#1a1a2e",
              color: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "500",
              boxShadow: "0 4px 20px rgba(0, 255, 255, 0.2)",
              transition: "all 0.3s ease",
              opacity: loading ? 0.6 : 1
            }}
          >
            <option value="" style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }}>All</option>
            <option value="horror" style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }}>Horror</option>
            {!settings ? (
              <option value="" style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }} disabled>Loading categories...</option>
            ) : settings?.dvdCategoryIds?.map((categoryId) => {
              const categoryName = getCategoryName(categoryId);
              return (
                <option key={categoryId} value={categoryId} style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }}>
                  {categoryName}
                </option>
              );
            })}
          </select>
        </div>
        
        {/* Search Button */}
        {!loading && showSearchButton && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
            <button
              onClick={() => {
                setShowSearchButton(false); // Hide search button when clicked
                if (selectedCategory === "") {
                  handleScanAllCategories();
                } else if (selectedCategory === "horror") {
                  handleScanHorrorCategory();
                } else {
                  handleCategoryClick(selectedCategory);
                }
              }}
              style={{
                width: "33%",
                padding: "16px",
                fontSize: "16px",
                fontWeight: "600",
                backgroundColor: "#ff0066",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(255, 0, 102, 0.3)",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#cc0052";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 0, 102, 0.5)";
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#ff0066";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(255, 0, 102, 0.3)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Search
            </button>
          </div>
        )}
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
              {progress} ({completedPages}{totalPages ? `/${totalPages}` : ''} categories completed)
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {products.length > 0 && (
        <div>
          <h2 style={{ marginBottom: "16px", fontSize: "20px", fontWeight: "600", color: "#ffffff" }}>
            {selectedCategory === "all" ? "All DVD Categories" : selectedCategory === "horror" ? "Horror" : getCategoryName(selectedCategory)} ({products.length} DVDs)
          </h2>
          
          <div style={{ 
            display: "grid", 
            gap: "16px", 
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" 
          }}>
            {products.map((product, index) => (
              <div 
                key={`${product.productId}-${index}`}
                style={{
                  padding: "16px",
                  border: "1px solid #7b2cbf",
                  borderRadius: "8px",
                  backgroundColor: "#1a1a2e",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(123, 44, 191, 0.3)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "#c084fc";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#7b2cbf";
                }}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  {product.imageUrl && (
                    <img 
                      src={`/api/image-proxy?url=${encodeURIComponent(product.imageUrl)}`}
                      alt={product.name}
                      style={{
                        width: "60px",
                        height: "80px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        flexShrink: 0
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      fontSize: "16px", 
                      fontWeight: "600", 
                      marginBottom: "8px", 
                      color: "#ffffff",
                      lineHeight: "1.3"
                    }}>
                      {product.name}
                    </h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "18px", fontWeight: "700", color: "#ff66a3" }}>
                        {product.price}
                      </span>
                      <span style={{ fontSize: "12px", color: "#c084fc", backgroundColor: "rgba(123, 44, 191, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                        {getCategoryName(product.categoryId)}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "8px" }}>
                      {product.store}
                    </div>
                    <a 
                      href={product.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "6px 12px",
                        backgroundColor: "#7b2cbf",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#6b21a8";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#7b2cbf";
                      }}
                    >
                      View on CEX →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && products.length === 0 && selectedCategory && (
        <div style={{
          padding: "40px",
          textAlign: "center",
          color: "#a0a0a0",
          fontSize: "16px"
        }}>
          No DVDs found. Try selecting a different category or store group.
        </div>
      )}
      
      <style jsx>{`
        @media (min-width: 768px) {
          .store-buttons-container button {
            min-width: calc(25% - 6px) !important;
          }
        }
      `}</style>
    </div>
  );
}
