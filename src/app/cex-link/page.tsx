"use client";
import React, { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";

export default function CEXLinkPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copiedCategoryId, setCopiedCategoryId] = useState<string | null>(null);

  useEffect(() => {
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

  const getCategoryName = (categoryId: string) => {
    if (!settings || !settings.categoryMap) {
      return `Category ${categoryId}`;
    }
    return settings.categoryMap[categoryId] || `Category ${categoryId}`;
  };

  const convertStoreNameForAPI = (storeName: string): string => {
    return storeName
      .replace(/\s*-\s*/g, '+-+')  // Replace hyphen with optional spaces around it
      .replace(/\s+/g, '+');       // Replace remaining spaces with +
  };

  const buildCEXLink = (categoryId: string, storeName: string) => {
    const baseUrl = "https://uk.webuy.com/search";
    const convertedStoreName = convertStoreNameForAPI(storeName);
    // Manually construct URL to avoid URLSearchParams encoding the + characters
    return `${baseUrl}?categoryIds=${categoryId}&sortBy=prod_cex_uk_price_desc&stores=${convertedStoreName}`;
  };

  const copyToClipboard = async (text: string, categoryId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCategoryId(categoryId);
      setTimeout(() => {
        setCopiedCategoryId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const allCategories = [
    ...(settings?.retroCategoryIds || []),
    ...(settings?.discBasedGameCategoryIds || [])
  ];

  return (
    <div style={{ 
      padding: "20px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
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

      {settings && (
        <>
          {/* Store Dropdown */}
          <div style={{ marginBottom: "32px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "12px", 
              fontSize: "16px",
              fontWeight: "600",
              color: "#00ffff",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}>
              Select Store
            </label>
            <select 
              value={selectedStore} 
              onChange={(e) => setSelectedStore(e.target.value)}
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "16px",
                border: "2px solid rgba(0, 255, 255, 0.3)",
                borderRadius: "8px",
                backgroundColor: "#1a1a2e",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: "500",
                boxShadow: "0 4px 20px rgba(0, 255, 255, 0.2)",
                transition: "all 0.3s ease"
              }}
            >
              <option value="" style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }}>-- Select a store --</option>
              {settings?.allStores && Object.keys(settings.allStores)
                .sort((a, b) => a.localeCompare(b))
                .map((storeName) => (
                  <option key={storeName} value={storeName} style={{ backgroundColor: "#1a1a2e", color: "#ffffff" }}>
                    {storeName}
                  </option>
                ))}
            </select>
          </div>

          {/* Category Links */}
          {selectedStore && allCategories.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <h2 style={{ 
                marginBottom: "24px", 
                fontSize: "24px", 
                fontWeight: "600",
                color: "#333",
                textAlign: "center"
              }}>
                CEX Links for {selectedStore}
              </h2>

              <div style={{ 
                display: "grid", 
                gap: "24px",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))"
              }}>
                {allCategories.map((categoryId) => {
                  const categoryName = getCategoryName(categoryId);
                  const link = buildCEXLink(categoryId, selectedStore);
                  const isCopied = copiedCategoryId === categoryId;
                  
                  return (
                    <div 
                      key={categoryId}
                      style={{
                        padding: "24px",
                        borderRadius: "12px",
                        backgroundColor: "#ffffff",
                        transition: "all 0.3s ease",
                        position: "relative",
                        overflow: "hidden",
                        textAlign: "center"
                      }}
                    >
                      <h3 style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        marginBottom: "16px",
                        color: "#0a0a0a",
                        letterSpacing: "0.5px"
                      }}>
                        {categoryName}
                      </h3>
                      
                      <div style={{ 
                        display: "flex", 
                        gap: "12px", 
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            display: "inline-block",
                            padding: "14px 20px",
                            backgroundColor: "#ff0066",
                            color: "#fff",
                            textDecoration: "none",
                            borderRadius: "8px",
                            fontSize: "15px",
                            fontWeight: "600",
                            textAlign: "center",
                            transition: "all 0.3s ease",
                            boxShadow: "0 4px 15px rgba(255, 0, 102, 0.3)"
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
                          View on CEX →
                        </a>
                        
                        <button
                          onClick={() => copyToClipboard(link, categoryId)}
                          style={{
                            padding: "14px",
                            backgroundColor: isCopied ? "#00ff88" : "rgba(0, 255, 255, 0.1)",
                            border: `2px solid ${isCopied ? "#00ff88" : "rgba(0, 255, 255, 0.3)"}`,
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "48px",
                            height: "48px"
                          }}
                          onMouseOver={(e) => {
                            if (!isCopied) {
                              e.currentTarget.style.backgroundColor = "rgba(0, 255, 255, 0.2)";
                              e.currentTarget.style.borderColor = "rgba(0, 255, 255, 0.5)";
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isCopied) {
                              e.currentTarget.style.backgroundColor = "rgba(0, 255, 255, 0.1)";
                              e.currentTarget.style.borderColor = "rgba(0, 255, 255, 0.3)";
                            }
                          }}
                          title="Copy URL"
                        >
                          {isCopied ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedStore && allCategories.length === 0 && (
            <div style={{
              padding: "32px",
              backgroundColor: "rgba(255, 193, 7, 0.1)",
              border: "2px solid rgba(255, 193, 7, 0.3)",
              borderRadius: "12px",
              color: "#856404",
              marginTop: "32px",
              textAlign: "center",
              fontSize: "16px"
            }}>
              No categories configured in settings.
            </div>
          )}

          {!selectedStore && (
            <div style={{
              padding: "60px 40px",
              textAlign: "center",
              color: "#666",
              fontSize: "18px",
              fontWeight: "500"
            }}>
              Please select a store to view CEX links
            </div>
          )}
        </>
      )}
    </div>
  );
}

