'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { MobileDrawer, MobileBottomNav } from './MobileNavigation';
import GlobalLoading from './GlobalLoading';

/**
 * Global Page Container and Application Shell
 * Wraps page content with responsive sidebar, navbar, mobile drawer, and bottom navigation
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export default function PageContainer({ children, className = '' }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <GlobalLoading />

      {/* Persistent Left Sidebar on Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="app-main">
        <Navbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main id="main-content" className={`page-container container ${className}`.trim()} tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Slide-out Drawer for Tablet/Mobile */}
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Bottom Navigation Bar for Mobile Phones */}
      <MobileBottomNav />
    </div>
  );
}
