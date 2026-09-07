'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './Sidebar';

/**
 * Mobile Navigation Primitives:
 * 1. MobileDrawer (slide-out menu for < 1024px)
 * 2. MobileBottomNav (fixed thumb bar for < 768px)
 */

export function MobileDrawer({ isOpen, onClose }) {
  const pathname = usePathname();
  const drawerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      // Focus first link in drawer
      const firstLink = drawerRef.current?.querySelector('a, button');
      firstLink?.focus();

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRouteActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div
      className="mobile-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation Menu"
      >
        <div className="mobile-drawer-header">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="sidebar-logo-mark" aria-hidden="true">
              EB
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', lineHeight: 1.2 }}>EduBridge</div>
              <div className="text-caption">Adaptive Learning</div>
            </div>
          </Link>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Mobile Links">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`.trim()}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                <span className="sidebar-link-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const isRouteActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      {NAV_ITEMS.map((item) => {
        const active = isRouteActive(item.href);
        const isUpload = item.href === '/upload' || item.href === '/textbooks';

        if (isUpload) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-bottom-nav-item"
              aria-label="Upload Textbook Scan"
              aria-current={active ? 'page' : undefined}
            >
              <div className="mobile-bottom-action-btn" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span style={{ marginTop: '2px' }}>Upload</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-bottom-nav-item ${active ? 'mobile-bottom-nav-item-active' : ''}`.trim()}
            aria-current={active ? 'page' : undefined}
          >
            <div className="mobile-bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
