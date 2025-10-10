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
          {/* Sort Info */}
          <div style={{ marginBottom: "16px" }}>
            <span className="muted" style={{ fontSize: "14px" }}>
              In Stock: Sorted by quantity (highest first) | Out of Stock: Sorted by name (A-Z)
            </span>
          </div>

          {/* In Stock Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#28a745" }}>✅ In Stock ({inStockResults.length})</h3>
            {inStockResults.length > 0 ? (
              <table className="table" style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '80px' }}>Image</th>
                    <th style={{ textAlign: 'center', width: '200px' }}>Name</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Price</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Quantity</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Product ID</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {inStockResults.map(r => (
                    <tr key={r.productId}>
                      <td style={{ textAlign: 'center' }}>
                        {r.imageUrl ? (
                          <img 
                            src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                            alt={r.name || 'Product'} 
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
                            color: '#666',
                            margin: '0 auto'
                          }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.name}</td>
                      <td style={{ textAlign: 'center' }}>{r.price || "N/A"}</td>
                      <td style={{ textAlign: 'center' }}>{r.quantity ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>{r.productId}</td>
                      <td style={{ textAlign: 'center' }}>
                        <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                No products in stock
              </p>
            )}
          </div>

          {/* Out of Stock Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#dc3545" }}>❌ Out of Stock ({outOfStockResults.length})</h3>
            {outOfStockResults.length > 0 ? (
              <table className="table" style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '80px' }}>Image</th>
                    <th style={{ textAlign: 'center', width: '200px' }}>Name</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Price</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Quantity</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Product ID</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfStockResults.map(r => (
                    <tr key={r.productId}>
                      <td style={{ textAlign: 'center' }}>
                        {r.imageUrl ? (
                          <img 
                            src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                            alt={r.name || 'Product'} 
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
                            color: '#666',
                            margin: '0 auto'
                          }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.name}</td>
                      <td style={{ textAlign: 'center' }}>{r.price || "N/A"}</td>
                      <td style={{ textAlign: 'center' }}>{r.quantity ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>{r.productId}</td>
                      <td style={{ textAlign: 'center' }}>
                        <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                No products out of stock
              </p>
            )}
          </div>

          {/* Failed Results - Only show if there are failed products */}
          {failedResults.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#ffc107" }}>⚠️ Failed ({failedResults.length})</h3>
              <table className="table" style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '80px' }}>Image</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Name</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Price</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Quantity</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Product ID</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Error Details</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {failedResults.map(r => (
                    <tr key={r.productId}>
                      <td style={{ textAlign: 'center' }}>
                        {r.imageUrl ? (
                          <img 
                            src={`/api/image-proxy?url=${encodeURIComponent(r.imageUrl)}`}
                            alt={r.name || 'Product'} 
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
                            color: '#666',
                            margin: '0 auto'
                          }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.name || "N/A"}</td>
                      <td style={{ textAlign: 'center' }}>{r.price || "N/A"}</td>
                      <td style={{ textAlign: 'center' }}>{r.quantity ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>{r.productId}</td>
                      <td style={{ textAlign: 'center' }} className="bad">
                        {r.stockNote?.includes("Error") ? "Error" : "Failed"}
                      </td>
                      <td style={{ textAlign: 'center' }} className="muted">{r.stockNote || ""}</td>
                      <td style={{ textAlign: 'center' }}>
                        <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              padding: "14px 24px",
              fontSize: "15px",
              fontWeight: "600",
              backgroundColor: loading || !canCheck ? "#ccc" : "#ff0066",
              color: "white",
              border: (checkType === 'essential' && !loading && canCheck) ? "3px solid #ff66a3" : "none",
              borderRadius: "8px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              minWidth: "140px",
              boxShadow: (checkType === 'essential' && !loading && canCheck)
                ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                : (loading || !canCheck) ? "none" : "0 4px 15px rgba(255, 0, 102, 0.3)",
              transition: "all 0.3s ease",
              transform: (checkType === 'essential' && !loading && canCheck) ? "scale(1.05)" : "scale(1)"
            }}
            onMouseOver={(e) => {
              if (!loading && canCheck) {
                e.currentTarget.style.backgroundColor = "#cc0052";
                const isSelected = checkType === 'essential';
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                  : "0 6px 20px rgba(255, 0, 102, 0.5)";
                e.currentTarget.style.transform = "scale(1.02)";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && canCheck) {
                const isSelected = checkType === 'essential';
                e.currentTarget.style.backgroundColor = "#ff0066";
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                  : "0 4px 15px rgba(255, 0, 102, 0.3)";
                e.currentTarget.style.transform = isSelected ? "scale(1.05)" : "scale(1)";
              }
            }}
          >
            {loading && checkType === 'essential' ? "Checking..." : "Essentials"}
          </button>
          <button 
            onClick={() => onCheckProducts('oneDay')}
            disabled={loading || !canCheck}
            style={{
              padding: "14px 24px",
              fontSize: "15px",
              fontWeight: "600",
              backgroundColor: loading || !canCheck ? "#ccc" : "#ff0066",
              color: "white",
              border: (checkType === 'oneDay' && !loading && canCheck) ? "3px solid #ff66a3" : "none",
              borderRadius: "8px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              minWidth: "140px",
              boxShadow: (checkType === 'oneDay' && !loading && canCheck)
                ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                : (loading || !canCheck) ? "none" : "0 4px 15px rgba(255, 0, 102, 0.3)",
              transition: "all 0.3s ease",
              transform: (checkType === 'oneDay' && !loading && canCheck) ? "scale(1.05)" : "scale(1)"
            }}
            onMouseOver={(e) => {
              if (!loading && canCheck) {
                e.currentTarget.style.backgroundColor = "#cc0052";
                const isSelected = checkType === 'oneDay';
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                  : "0 6px 20px rgba(255, 0, 102, 0.5)";
                e.currentTarget.style.transform = "scale(1.02)";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && canCheck) {
                const isSelected = checkType === 'oneDay';
                e.currentTarget.style.backgroundColor = "#ff0066";
                e.currentTarget.style.boxShadow = isSelected
                  ? "0 0 0 3px rgba(255, 102, 163, 0.3), 0 6px 20px rgba(255, 0, 102, 0.5)"
                  : "0 4px 15px rgba(255, 0, 102, 0.3)";
                e.currentTarget.style.transform = isSelected ? "scale(1.05)" : "scale(1)";
              }
            }}
          >
            {loading && checkType === 'oneDay' ? "Checking..." : "Nice to Have"}
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
