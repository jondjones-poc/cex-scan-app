"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navItems = [
    { href: "/", label: "Stock Checker" },
    { href: "/whats-in-stock", label: "Retro Games" },
    { href: "/disc-based-games", label: "Modern Games" },
    { href: "/store-checker", label: "Store Checker" },
    { href: "/cex-link", label: "Store Links" },
    { href: "/store-links", label: "Location Links" },
    { href: "/dvds", label: "DVDs" }
  ];

  useEffect(() => {
    const checkMobile = () => {
      // Check screen width
      const isSmallScreen = window.innerWidth <= 768;
      
      // Check user agent for mobile devices
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Check for touch capability
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if any of these conditions are true
      const isMobileDevice = isSmallScreen || (isMobileUserAgent && isTouchDevice);
      
      console.log('Mobile detection:', { isSmallScreen, isMobileUserAgent, isTouchDevice, isMobileDevice });
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && isMobile) {
        const target = event.target as HTMLElement;
        if (!target.closest('nav')) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMobileMenuOpen, isMobile]);

  const linkStyle = (href: string) => ({
    color: "white",
    textDecoration: "none",
    fontWeight: pathname === href ? "600" : "400",
    fontSize: "16px",
    padding: "8px 16px",
    borderRadius: "4px",
    backgroundColor: pathname === href ? "rgba(255,255,255,0.2)" : "transparent",
    transition: "all 0.2s ease",
    display: "block",
    width: "100%",
    textAlign: "left" as const
  });

  const desktopLinkStyle = (href: string) => ({
    color: "white",
    textDecoration: "none",
    fontWeight: pathname === href ? "600" : "400",
    fontSize: "16px",
    padding: "8px 16px",
    borderRadius: "4px",
    backgroundColor: pathname === href ? "rgba(255,255,255,0.2)" : "transparent",
    transition: "all 0.2s ease"
  });

  return (
    <nav style={{
      backgroundColor: "#e20a03",
      padding: "12px 24px",
      marginBottom: "24px",
      borderRadius: "8px"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        {/* Desktop Navigation */}
        {!isMobile && (
          <div style={{
            display: "flex",
            gap: "24px",
            alignItems: "center"
          }}>
            {navItems.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                style={desktopLinkStyle(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Mobile Menu Button */}
        {isMobile && (
          <div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "24px",
                cursor: "pointer",
                padding: "12px",
                minWidth: "44px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent"
              }}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
          </div>
        )}
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobile && isMobileMenuOpen && (
        <div style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          position: "relative",
          zIndex: 1000,
          backgroundColor: "#e20a03",
          borderRadius: "0 0 8px 8px"
        }}>
          {navItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              onClick={() => setIsMobileMenuOpen(false)}
              onTouchEnd={() => setIsMobileMenuOpen(false)}
              style={{
                ...linkStyle(item.href),
                marginBottom: "8px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent"
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}



