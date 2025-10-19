"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const navItems = [
    { href: "/", label: "Stock Checker" },
    { href: "/retro-game-checker", label: "Retro Games" },
    { href: "/modern-game-search", label: "Modern Games" },
    { href: "/store-checker", label: "Store Checker" },
    { href: "/cex-link", label: "Store Links" },
    { href: "/store-links", label: "Location Links" },
    { href: "/dvds", label: "DVDs" }
  ];

  useEffect(() => {
    const checkMobile = () => {
      // Simple screen width check - most reliable method
      const isMobileDevice = window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };
    
    // Check immediately
    checkMobile();
    
    // Also check after a short delay to handle any timing issues
    const timeoutId = setTimeout(checkMobile, 100);
    
    // Check on resize
    window.addEventListener('resize', checkMobile);
    
    // Check on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(checkMobile, 100);
    });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (isMobileMenuOpen && isMobile && navRef.current) {
        const target = event.target as HTMLElement;
        if (!navRef.current.contains(target)) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
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
    <nav ref={navRef} style={{
      backgroundColor: "#e20a03",
      padding: "12px 24px",
      marginBottom: "24px",
      borderRadius: "8px",
      position: "relative",
      zIndex: 1000
    }}>
      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav { display: none !important; }
        }
      `}</style>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        {/* Desktop Navigation */}
        <div className="desktop-nav" style={{
          display: isMobile ? "none" : "flex",
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

        {/* Mobile Menu Button and Current Page */}
        <div className="mobile-nav" style={{
          display: isMobile ? "flex" : "none",
          alignItems: "center",
          gap: "12px"
        }}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
                touchAction: "manipulation"
              }}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
            <div style={{
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              textAlign: "right"
            }}>
              {navItems.find(item => item.href === pathname)?.label || "Stock Checker"}
            </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && isMobile && (
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: "fixed",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 1000
            }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu */}
          <div className="mobile-nav" style={{
            position: "absolute",
            top: "100%",
            left: "0",
            right: "0",
            backgroundColor: "#e20a03",
            borderRadius: "0 0 8px 8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 1001,
            padding: "16px 0",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            flexDirection: "column"
          }}>
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  // Use router.push for proper Next.js navigation
                  router.push(item.href);
                }}
                style={{
                  ...linkStyle(item.href),
                  marginBottom: "8px",
                  minHeight: "44px",
                  display: "block",
                  alignItems: "center",
                  touchAction: "manipulation",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}



