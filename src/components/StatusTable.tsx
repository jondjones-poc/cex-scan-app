"use client";
import React, { useMemo } from "react";
import type { ProductCheckResult } from "@/lib/cex";

interface StatusTableProps {
  results: ProductCheckResult[];
  loading: boolean;
  onCheckProducts: (type: 'essential' | 'oneDay') => void;
  canCheck: boolean;
  totalProducts?: number;
  checkType?: 'essential' | 'oneDay' | null;
}

export default function StatusTable({ results, loading, onCheckProducts, canCheck, totalProducts, checkType }: StatusTableProps) {

  // Separate results into in stock and out of stock based on quantity
  // In Stock: Has quantity > 0
  const inStockResults = useMemo(() => {
    const filtered = results.filter(r => 
      r.name && 
      !r.stockNote?.includes("Error") && 
      r.httpStatus === 200 &&
      (r.quantity || 0) > 0
    );
    
    // Sort by quantity (highest first)
    return filtered.sort((a, b) => {
      const quantityA = parseFloat((a.quantity || 0).toString()) || 0;
      const quantityB = parseFloat((b.quantity || 0).toString()) || 0;
      return quantityB - quantityA;
    });
  }, [results]);

  // Out of Stock: Has quantity = 0
  const outOfStockResults = useMemo(() => {
    const filtered = results.filter(r => 
      r.name && 
      !r.stockNote?.includes("Error") && 
      r.httpStatus === 200 &&
      (r.quantity || 0) === 0
    );
    
    // Sort by name alphabetically
    return filtered.sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  // Failed: No real name OR has errors OR failed API call
  const failedResults = useMemo(() => {
    const filtered = results.filter(r => 
      !r.name || 
      r.stockNote?.includes("Error") || 
      r.httpStatus !== 200
    );
    
    // Sort by name alphabetically
    return filtered.sort((a, b) => {
      const nameA = a.name || 'N/A';
      const nameB = b.name || 'N/A';
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  return (
    <div>
      {loading && (
        <div style={{ marginBottom: 16 }}>
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
              Checking... ({results.length}{totalProducts ? `/${totalProducts}` : ''} products completed)
            </span>
          </div>
          {totalProducts && totalProducts > 0 && (
            <div style={{ 
              width: "100%", 
              height: "4px", 
              backgroundColor: "#f0f0f0", 
              borderRadius: "2px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${(results.length / totalProducts) * 100}%`,
                height: "100%",
                backgroundColor: "#007bff",
                transition: "width 0.3s ease"
              }} />
            </div>
          )}
        </div>
      )}
      
      {results.length > 0 && (
        <>

          {/* In Stock Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#28a745", fontSize: "20px", fontWeight: "600" }}>✅ In Stock ({inStockResults.length})</h3>
            {inStockResults.length > 0 ? (
              <div style={{ 
                display: "grid", 
                gap: "16px", 
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" 
              }}>
                {inStockResults.map(r => (
                  <div 
                    key={r.productId}
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
                      {r.imageUrl ? (
                        <img 
                          src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                          alt={r.name || 'Product'} 
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            flexShrink: 0
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#2a2a3e",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          color: "#a0a0a0",
                          flexShrink: 0
                        }}>
                          No Image
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          fontSize: "16px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          color: "#ffffff",
                          lineHeight: "1.3"
                        }}>
                          {r.name}
                        </h3>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "700", color: "#ff66a3" }}>
                            {r.price || "N/A"}
                          </span>
                          <span style={{ fontSize: "12px", color: "#28a745", backgroundColor: "rgba(40, 167, 69, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                            Qty: {r.quantity ?? 0}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "8px" }}>
                          ID: {r.productId}
                          {(() => {
                            // Client-side logging for debugging
                            console.log(`[StatusTable InStock] Product ${r.productId}:`, {
                              inStock: r.inStock,
                              quantity: r.quantity,
                              stores: r.stores,
                              storesType: typeof r.stores,
                              storesLength: r.stores?.length,
                              hasStores: !!r.stores && r.stores.length > 0,
                              fullResult: r
                            });
                            
                            if (r.stores && r.stores.length > 0) {
                              const sortedStores = [...r.stores].sort((a, b) => a.localeCompare(b));
                              console.log(`[StatusTable InStock] Displaying ${sortedStores.length} stores for ${r.productId}:`, sortedStores);
                              return (
                                <div style={{ fontSize: "11px", color: "#28a745", marginTop: "4px" }}>
                                  Stores: {sortedStores.join(", ")}
                                </div>
                              );
                            } else if (r.inStock && r.quantity && r.quantity > 0) {
                              console.warn(`[StatusTable InStock] ⚠️ Product ${r.productId} is in stock (qty: ${r.quantity}) but has no stores!`, r);
                              return null;
                            }
                            return null;
                          })()}
                        </div>
                        <a 
                          href={r.url} 
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
            ) : (
              <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                No products in stock
              </p>
            )}
          </div>

          {/* Out of Stock Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#dc3545", fontSize: "20px", fontWeight: "600" }}>❌ Out of Stock ({outOfStockResults.length})</h3>
            {outOfStockResults.length > 0 ? (
              <div style={{ 
                display: "grid", 
                gap: "16px", 
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" 
              }}>
                {outOfStockResults.map(r => (
                  <div 
                    key={r.productId}
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
                      {r.imageUrl ? (
                        <img 
                          src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                          alt={r.name || 'Product'} 
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            flexShrink: 0
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#2a2a3e",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          color: "#a0a0a0",
                          flexShrink: 0
                        }}>
                          No Image
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          fontSize: "16px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          color: "#ffffff",
                          lineHeight: "1.3"
                        }}>
                          {r.name}
                        </h3>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "700", color: "#ff66a3" }}>
                            {r.price || "N/A"}
                          </span>
                          <span style={{ fontSize: "12px", color: "#dc3545", backgroundColor: "rgba(220, 53, 69, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                            Out of Stock
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "8px" }}>
                          ID: {r.productId}
                          {r.stores && r.stores.length > 0 && (
                            <div style={{ fontSize: "11px", color: "#28a745", marginTop: "4px" }}>
                              Stores: {[...r.stores].sort((a, b) => a.localeCompare(b)).join(", ")}
                            </div>
                          )}
                        </div>
                        <a 
                          href={r.url} 
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
            ) : (
              <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                No products out of stock
              </p>
            )}
          </div>

          {/* Failed Results - Only show if there are failed products */}
          {failedResults.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 16px 0", color: "#ffc107", fontSize: "20px", fontWeight: "600" }}>⚠️ Failed ({failedResults.length})</h3>
              <div style={{ 
                display: "grid", 
                gap: "16px", 
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" 
              }}>
                {failedResults.map(r => (
                  <div 
                    key={r.productId}
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
                      {r.imageUrl ? (
                        <img 
                          src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                          alt={r.name || 'Product'} 
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            flexShrink: 0
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#2a2a3e",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          color: "#a0a0a0",
                          flexShrink: 0
                        }}>
                          No Image
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          fontSize: "16px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          color: "#ffffff",
                          lineHeight: "1.3"
                        }}>
                          {r.name || "N/A"}
                        </h3>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "700", color: "#ff66a3" }}>
                            {r.price || "N/A"}
                          </span>
                          <span style={{ fontSize: "12px", color: "#ffc107", backgroundColor: "rgba(255, 193, 7, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                            {r.stockNote?.includes("Error") ? "Error" : "Failed"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "8px" }}>
                          ID: {r.productId}
                          {r.stores && r.stores.length > 0 && (
                            <div style={{ fontSize: "11px", color: "#28a745", marginTop: "4px" }}>
                              Stores: {[...r.stores].sort((a, b) => a.localeCompare(b)).join(", ")}
                            </div>
                          )}
                        </div>
                        {r.stockNote && (
                          <div style={{ fontSize: "11px", color: "#ffc107", marginBottom: "8px", fontStyle: "italic" }}>
                            {r.stockNote}
                          </div>
                        )}
                        <a 
                          href={r.url} 
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
        </>
      )}
      
      <div style={{ marginTop: "16px", textAlign: "left" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
          <button 
            onClick={() => onCheckProducts('essential')}
            disabled={loading || !canCheck}
            style={{
              flex: "1",
              padding: "16px",
              fontSize: "16px",
              fontWeight: "600",
              backgroundColor: loading || !canCheck ? "#333" : "#1a1a2e",
              color: "#ffffff",
              border: (checkType === 'essential' && !loading && canCheck) ? "2px solid rgba(0, 255, 255, 0.8)" : "2px solid rgba(0, 255, 255, 0.3)",
              borderRadius: "8px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              boxShadow: (checkType === 'essential' && !loading && canCheck)
                ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                : (loading || !canCheck) ? "none" : "0 4px 20px rgba(0, 255, 255, 0.2)",
              transition: "all 0.3s ease",
              transform: (checkType === 'essential' && !loading && canCheck) ? "scale(1.02)" : "scale(1)"
            }}
            onMouseOver={(e) => {
              if (!loading && canCheck) {
                e.currentTarget.style.backgroundColor = "#2a2a4e";
                const isSelected = checkType === 'essential';
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                  : "0 6px 20px rgba(0, 255, 255, 0.3)";
                e.currentTarget.style.transform = "scale(1.02)";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && canCheck) {
                const isSelected = checkType === 'essential';
                e.currentTarget.style.backgroundColor = "#1a1a2e";
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                  : "0 4px 20px rgba(0, 255, 255, 0.2)";
                e.currentTarget.style.transform = isSelected ? "scale(1.02)" : "scale(1)";
              }
            }}
          >
            {loading && checkType === 'essential' ? "Checking..." : "⚡ Essentials"}
          </button>
          <button 
            onClick={() => onCheckProducts('oneDay')}
            disabled={loading || !canCheck}
            style={{
              flex: "1",
              padding: "16px",
              fontSize: "16px",
              fontWeight: "600",
              backgroundColor: loading || !canCheck ? "#333" : "#1a1a2e",
              color: "#ffffff",
              border: (checkType === 'oneDay' && !loading && canCheck) ? "2px solid rgba(0, 255, 255, 0.8)" : "2px solid rgba(0, 255, 255, 0.3)",
              borderRadius: "8px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              boxShadow: (checkType === 'oneDay' && !loading && canCheck)
                ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                : (loading || !canCheck) ? "none" : "0 4px 20px rgba(0, 255, 255, 0.2)",
              transition: "all 0.3s ease",
              transform: (checkType === 'oneDay' && !loading && canCheck) ? "scale(1.02)" : "scale(1)"
            }}
            onMouseOver={(e) => {
              if (!loading && canCheck) {
                e.currentTarget.style.backgroundColor = "#2a2a4e";
                const isSelected = checkType === 'oneDay';
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                  : "0 6px 20px rgba(0, 255, 255, 0.3)";
                e.currentTarget.style.transform = "scale(1.02)";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && canCheck) {
                const isSelected = checkType === 'oneDay';
                e.currentTarget.style.backgroundColor = "#1a1a2e";
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(0, 255, 255, 0.3), 0 4px 20px rgba(0, 255, 255, 0.4)"
                  : "0 4px 20px rgba(0, 255, 255, 0.2)";
                e.currentTarget.style.transform = isSelected ? "scale(1.02)" : "scale(1)";
              }
            }}
          >
            {loading && checkType === 'oneDay' ? "Checking..." : "⭐ Nice to Have"}
          </button>
        </div>
        {!canCheck && (
          <p className="muted" style={{ marginTop: "8px", fontSize: "14px" }}>
            Loading settings...
          </p>
        )}
        {checkType && (
          <p className="muted" style={{ marginTop: "8px", fontSize: "14px" }}>
            Checking {checkType === 'essential' ? 'Essential' : 'Nice to Have'} products
          </p>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
