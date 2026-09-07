'use client';

import React from 'react';
import { parseApiError } from '../../lib/errorParser';

/**
 * InlineError Component
 *
 * Scoped error notification for form fields, cards, or specific section failures
 * without taking down or obscuring the entire page.
 *
 * @param {Object} props
 * @param {Error|Object|string} [props.error] - Error to parse
 * @param {string} [props.message] - Custom error message
 * @param {string} [props.title] - Optional bold title
 * @param {function} [props.onRetry] - Optional inline retry callback
 * @param {boolean} [props.compact=false] - Compact single-line styling
 * @param {string} [props.className='']
 */
export default function InlineError({
  error,
  message,
  title,
  onRetry,
  compact = false,
  className = ''
}) {
  const parsed = error ? parseApiError(error) : null;
  const displayTitle = title || (compact ? null : parsed?.title);
  const displayMessage = message || parsed?.message || 'An unexpected condition occurred. Please try again.';

  if (!displayMessage) return null;

  return (
    <div
      role="alert"
      className={`inline-error-box ${compact ? 'inline-error-box--compact' : ''} ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 'var(--spacing-3)',
        padding: compact ? 'var(--spacing-2) var(--spacing-3)' : 'var(--spacing-3) var(--spacing-4)',
        background: 'var(--color-danger-50)',
        border: '1px solid var(--color-danger-500)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-danger-900)',
        fontSize: 'var(--font-size-small)',
        lineHeight: 'var(--line-height-normal)'
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: compact ? 0 : '2px', color: 'var(--color-danger-700)' }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <div style={{ flexGrow: 1 }}>
        {displayTitle && (
          <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--color-danger-900)' }}>
            {displayTitle}
          </strong>
        )}
        <span>{displayMessage}</span>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-error-retry-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-danger-700)',
            textDecoration: 'underline',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-caption)',
            cursor: 'pointer',
            padding: '2px 4px',
            flexShrink: 0
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export { InlineError };
