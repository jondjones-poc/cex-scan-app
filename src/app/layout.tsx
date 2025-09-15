import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header style={{ marginBottom: 16 }}>
            <h1>CeX Stock Monitor</h1>
          </header> 
          {children}
        </div>
      </body>
    </html>
  );
}
