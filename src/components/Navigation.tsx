"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav style={{
      backgroundColor: "#e20a03",
      padding: "12px 24px",
      marginBottom: "24px",
      borderRadius: "8px"
    }}>
      <div style={{
        display: "flex",
        gap: "24px",
        alignItems: "center"
      }}>
        <Link 
          href="/" 
          style={{
            color: "white",
            textDecoration: "none",
            fontWeight: pathname === "/" ? "600" : "400",
            fontSize: "16px",
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: pathname === "/" ? "rgba(255,255,255,0.2)" : "transparent",
            transition: "all 0.2s ease"
          }}
        >
          Stock Checker
        </Link>
        <Link 
          href="/whats-in-stock" 
          style={{
            color: "white",
            textDecoration: "none",
            fontWeight: pathname === "/whats-in-stock" ? "600" : "400",
            fontSize: "16px",
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: pathname === "/whats-in-stock" ? "rgba(255,255,255,0.2)" : "transparent",
            transition: "all 0.2s ease"
          }}
        >
          What's in Stock
        </Link>
      </div>
    </nav>
  );
}

