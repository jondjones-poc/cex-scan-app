import "./globals.css";
import React from "react";
import Navigation from "@/components/Navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CeX Stock Monitor",
  description: "Monitor CeX stock levels and find rare games",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <Navigation />
          {children}
        </div>
      </body>
    </html>
  );
}
