import "./globals.css";
import React from "react";
import Navigation from "@/components/Navigation";

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
