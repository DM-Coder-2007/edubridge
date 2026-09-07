'use client';

import React from 'react';
import { useLoading } from '../../context/LoadingContext';

/**
 * Global Loading Indicator System
 * Injects non-intrusive progress bar and screen reader announcement
 */
export default function GlobalLoading() {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

  return (
    <>
      <div
        className="global-loading-bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={loadingMessage || 'System loading'}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {loadingMessage || 'Loading page content, please wait...'}
      </div>
    </>
  );
}
