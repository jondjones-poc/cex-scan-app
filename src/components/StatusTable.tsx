"use client";
import React, { useState, useMemo } from "react";
import type { ProductCheckResult } from "@/lib/cex";

interface StatusTableProps {
  results: ProductCheckResult[];
  loading: boolean;
  onCheckProducts: () => void;
  canCheck: boolean;
}

export default function StatusTable({ results, loading, onCheckProducts, canCheck }: StatusTableProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Separate results into successful and unsuccessful
  // Successful: Has a real product name AND no errors AND successful API call
  const successfulResults = useMemo(() => {
    const filtered = results.filter(r => 
      r.name && 
      !r.stockNote?.includes("Error") && 
      r.httpStatus === 200
    );
    
    // Sort alphabetically by name
    return filtered.sort((a, b) => {
      const comparison = (a.name || "").localeCompare(b.name || "");
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [results, sortOrder]);

  // Unsuccessful: No real name OR has errors OR failed API call
  const unsuccessfulResults = useMemo(() => {
    const filtered = results.filter(r => 
      !r.name || 
      r.stockNote?.includes("Error") || 
      r.httpStatus !== 200
    );
    
    // Sort alphabetically by name
    return filtered.sort((a, b) => {
      const comparison = (a.name || "").localeCompare(b.name || "");
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [results, sortOrder]);

  return (
    <div className="card">
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 16 }}>
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
          <span className="muted">Checking...</span>
        </div>
      )}
      
      {results.length > 0 && (
        <>
          {/* Sort Controls */}
          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="muted" style={{ fontSize: "14px" }}>Sort by name:</span>
            <button
              onClick={() => setSortOrder('asc')}
              style={{
                padding: "6px 12px",
                fontSize: "14px",
                backgroundColor: sortOrder === 'asc' ? "#007bff" : "#f8f9fa",
                color: sortOrder === 'asc' ? "white" : "#333",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              ↑ Ascending
            </button>
            <button
              onClick={() => setSortOrder('desc')}
              style={{
                padding: "6px 12px",
                fontSize: "14px",
                backgroundColor: sortOrder === 'desc' ? "#007bff" : "#f8f9fa",
                color: sortOrder === 'desc' ? "white" : "#333",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              ↓ Descending
            </button>
          </div>

          {/* Successful Results - Always show this section */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#28a745" }}>✅ Successful ({successfulResults.length})</h3>
            {successfulResults.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
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
        <button 
          onClick={onCheckProducts}
          disabled={loading || !canCheck}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor: loading || !canCheck ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || !canCheck ? "not-allowed" : "pointer",
            minWidth: "120px"
          }}
        >
          {loading ? "Checking..." : "Find Rare Games"}
        </button>
        {!canCheck && (
          <p className="muted" style={{ marginTop: "8px", fontSize: "14px" }}>
            Loading settings...
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
