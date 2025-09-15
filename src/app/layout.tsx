import "./globals.css";
import React from "react";
import Navigation from "@/components/Navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CeX Stock Monitor",
  description: "Monitor CeX stock levels and find rare games",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header style={{ marginBottom: 16 }}>
            <h1>CeX Stock Monitor</h1>
          </header>
          <Navigation />
          {children}
        </div>
      </body>
    </html>
  );
}
