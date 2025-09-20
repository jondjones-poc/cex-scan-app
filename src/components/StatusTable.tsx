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

  // Separate results into successful and unsuccessful
  // Successful: Has a real product name AND no errors AND successful API call
  const successfulResults = useMemo(() => {
    const filtered = results.filter(r => 
      r.name && 
      !r.stockNote?.includes("Error") && 
      r.httpStatus === 200
    );
    
    // Sort by stock status first (in stock first), then by price (highest first)
    return filtered.sort((a, b) => {
      // First sort by stock status (in stock items first)
      if (a.inStock !== b.inStock) {
        return a.inStock ? -1 : 1;
      }
      
      // Then sort by price (highest first) - extract numeric value from price
      const priceA = parseFloat((a.quantity || 0).toString()) || 0;
      const priceB = parseFloat((b.quantity || 0).toString()) || 0;
      return priceB - priceA;
    });
  }, [results]);

  // Unsuccessful: No real name OR has errors OR failed API call
  const unsuccessfulResults = useMemo(() => {
    const filtered = results.filter(r => 
      !r.name || 
      r.stockNote?.includes("Error") || 
      r.httpStatus !== 200
    );
    
    // Sort by stock status first (in stock first), then by price (highest first)
    return filtered.sort((a, b) => {
      // First sort by stock status (in stock items first)
      if (a.inStock !== b.inStock) {
        return a.inStock ? -1 : 1;
      }
      
      // Then sort by price (highest first) - extract numeric value from price
      const priceA = parseFloat((a.quantity || 0).toString()) || 0;
      const priceB = parseFloat((b.quantity || 0).toString()) || 0;
      return priceB - priceA;
    });
  }, [results]);

  return (
    <div className="card">
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
              Sorted by: Stock status (in stock first) → Price (highest first)
            </span>
          </div>

          {/* Successful Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#28a745" }}>✅ Successful ({successfulResults.length})</h3>
            {successfulResults.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Product ID</th>
                    <th>Status</th>
                    <th>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {successfulResults.map(r => (
                    <tr key={r.productId}>
                      <td>
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
                            color: '#666'
                          }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td>{r.name}</td>
                      <td>{r.quantity ?? 0}</td>
                      <td>{r.productId}</td>
                      <td className={r.inStock ? "ok" : "bad"}>
                        {r.inStock ? "In stock" : "Out"}
                      </td>
                      <td>
                        <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ margin: "8px 0", fontStyle: "italic" }}>
                No products loaded successfully
              </p>
            )}
          </div>

          {/* Unsuccessful Results - Only show if there are failed products */}
          {unsuccessfulResults.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#dc3545" }}>❌ Failed ({unsuccessfulResults.length})</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Product ID</th>
                    <th>Status</th>
                    <th>Error Details</th>
                    <th>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {unsuccessfulResults.map(r => (
                    <tr key={r.productId}>
                      <td>
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
                            color: '#666'
                          }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td>{r.name || "N/A"}</td>
                      <td>{r.quantity ?? 0}</td>
                      <td>{r.productId}</td>
                      <td className="bad">
                        {r.stockNote?.includes("Error") ? "Error" : "Failed"}
                      </td>
                      <td className="muted">{r.stockNote || ""}</td>
                      <td>
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
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: loading || !canCheck ? "#ccc" : (checkType === 'essential' ? "#28a745" : "#007bff"),
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              minWidth: "140px"
            }}
          >
            {loading && checkType === 'essential' ? "Checking..." : "Essentials"}
          </button>
          <button 
            onClick={() => onCheckProducts('oneDay')}
            disabled={loading || !canCheck}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: loading || !canCheck ? "#ccc" : (checkType === 'oneDay' ? "#28a745" : "#6c757d"),
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading || !canCheck ? "not-allowed" : "pointer",
              minWidth: "140px"
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
