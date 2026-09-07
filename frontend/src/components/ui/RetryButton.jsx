'use client';

import React, { useState } from 'react';
import Button from './Button';

/**
 * RetryButton Component
 *
 * Dedicated, accessible retry control for recovering from failed API queries.
 * Manages loading feedback during async retries.
 */
export default function RetryButton({
  onRetry,
  isRetrying = false,
  label = 'Try Again',
  variant = 'secondary',
  size = 'md',
  className = '',
  ariaLabel
}) {
  const [internalLoading, setInternalLoading] = useState(false);

  const effectiveLoading = isRetrying || internalLoading;

  const handleClick = async (e) => {
    if (!onRetry || effectiveLoading) return;

    try {
      setInternalLoading(true);
      const result = onRetry(e);
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      loading={effectiveLoading}
      onClick={handleClick}
      aria-label={ariaLabel || label}
      className={className}
    >
      {!effectiveLoading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          style={{ marginRight: '6px' }}
        >
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      )}
      <span>{effectiveLoading ? 'Retrying...' : label}</span>
    </Button>
  );
}

export { RetryButton };
