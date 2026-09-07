'use client';

import React from 'react';
import Breadcrumb from './Breadcrumb';
import UserMenu from './UserMenu';
import NotificationArea from './NotificationArea';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Button, Tooltip } from '../ui';

/**
 * Global Top Navbar Component
 *
 * @param {Object} props
 * @param {function} [props.onOpenMobileMenu] - Handler to toggle mobile navigation drawer
 */
export default function Navbar({ onOpenMobileMenu }) {
  const { isHighContrast, toggleHighContrast, fontSize, cycleFontSize } = useAccessibility();

  return (
    <header className="navbar" role="banner">
      <div className="navbar-left">
        {/* Mobile menu hamburger toggle (< 1024px) */}
        <button
          type="button"
          className="btn btn-ghost btn-sm navbar-mobile-toggle"
          style={{ padding: 'var(--spacing-2)' }}
          onClick={onOpenMobileMenu}
          aria-label="Open mobile navigation menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Breadcrumb />
      </div>

      <div className="navbar-right">
        {/* Quick Accessibility Toggles */}
        <Tooltip text="Toggle Ultra High Contrast mode for visually impaired users">
          <Button
            variant={isHighContrast ? 'accent' : 'outline'}
            size="sm"
            onClick={toggleHighContrast}
            ariaLabel="Toggle High Contrast Mode"
          >
            <span aria-hidden="true" style={{ fontWeight: 'bold' }}>C</span>
            <span className="hidden-sm">{isHighContrast ? 'High Contrast ON' : 'Contrast'}</span>
          </Button>
        </Tooltip>

        <Tooltip text="Scale typography size (Normal, Large, X-Large)">
          <Button
            variant="outline"
            size="sm"
            onClick={cycleFontSize}
            ariaLabel="Adjust font scaling"
          >
            <span aria-hidden="true" style={{ fontWeight: 'bold' }}>A+</span>
            <span className="hidden-sm">{fontSize.toUpperCase()}</span>
          </Button>
        </Tooltip>

        <NotificationArea />
        <UserMenu />
      </div>
    </header>
  );
}
