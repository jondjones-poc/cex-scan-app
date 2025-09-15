"use client";
import React, { useState, useEffect } from "react";
import { checkProducts } from "@/lib/cex";
import StatusTable from "@/components/StatusTable";
import type { ProductCheckResult } from "@/lib/cex";

export default function HomePage() {
  const [results, setResults] = useState<ProductCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);

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
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleCheckProducts = async () => {
    if (!settings) return;
    
    setLoading(true);
    setResults([]);
    
    try {
      const checkResults = await checkProducts(
        settings.productIds, 
        settings,
        (progressResults) => {
          // Update results in real-time as each batch completes
          setResults(progressResults);
        }
      );
      setResults(checkResults);
    } catch (error) {
      console.error("Failed to check products:", error);
      const errorMessage = (error as Error).message;
      
      // Provide more specific error messages based on the error type
      let dynamicError = `Error: ${errorMessage}`;
      if (errorMessage.includes('fetch')) {
        dynamicError = `Network Error: ${errorMessage}`;
      } else if (errorMessage.includes('timeout')) {
        dynamicError = `Timeout Error: ${errorMessage}`;
      } else if (errorMessage.includes('CORS')) {
        dynamicError = `CORS Error: ${errorMessage}`;
      } else if (errorMessage.includes('settings')) {
        dynamicError = `Configuration Error: ${errorMessage}`;
      }
      
      // Set error results for all products
      const errorResults = settings.productIds.map((productId: string) => ({
        productId,
        url: `https://uk.webuy.com/product-detail?id=${productId}`,
        inStock: false,
        stockNote: dynamicError
      }));
      setResults(errorResults);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <StatusTable 
        results={results} 
        loading={loading}
        onCheckProducts={handleCheckProducts}
        canCheck={!!settings}
        totalProducts={settings?.productIds?.length}
      />
    </main>
  );
}
