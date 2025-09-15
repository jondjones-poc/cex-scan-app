"use client";
import React from "react";
import type { ProductCheckResult } from "@/lib/cex";

export default function StatusTable({ results }: { results: ProductCheckResult[] }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Stock Status</h2>
        <a href="/api/check" className="muted">Run check</a>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Note</th>
            <th>Product</th>
            <th>API</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.productId}>
              <td>{r.productId}</td>
              <td>{r.name || ""}</td>
              <td className={r.inStock ? "ok" : "bad"}>{r.inStock ? "In stock" : "Out"}</td>
              <td className="muted">{r.stockNote || ""}</td>
              <td>
                <a href={r.url} target="_blank" rel="noreferrer">Open</a>
              </td>
              <td>
                {r.apiUrl ? (
                  <a href={r.apiUrl} target="_blank" rel="noreferrer">Open</a>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
