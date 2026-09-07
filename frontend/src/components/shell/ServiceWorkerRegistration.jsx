'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegistration
 * Safely registers the offline audio service worker in supported browsers.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV !== 'test'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check for service worker updates periodically
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    console.log('[SW] New offline audio worker installed.');
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          // Graceful non-fatal fallback
          console.warn('[SW] Service worker registration warning:', err.message);
        });
    }
  }, []);

  return null;
}

export default ServiceWorkerRegistration;
