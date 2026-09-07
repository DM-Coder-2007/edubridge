'use client';

import React from 'react';
import RetryButton from './RetryButton';
import { parseApiError } from '../../lib/errorParser';

/**
 * Accessible Error State Component
 *
 * Catches failed API states and displays empathetic, user-friendly feedback
 * with prominent retry capabilities.
 *
 * @param {Object} props
 * @param {Error|Object|string} [props.error] - Raw API or JavaScript error to parse
 * @param {string} [props.title] - Override title
 * @param {string} [props.description] - Override message / description
 * @param {string} [props.message] - Alias for description
 * @param {function} [props.onRetry] - Callback to re-attempt the failed operation
 * @param {string} [props.retryText='Try Again'] - Label for retry button
 * @param {boolean} [props.isRetrying=false] - Async retrying status
 * @param {React.ReactNode} [props.secondaryAction] - Optional secondary button/link
 * @param {React.ReactNode} [props.icon] - Custom icon
 * @param {string} [props.className='']
 * @param {React.ReactNode} [props.children]
 */
export default function ErrorState({
  error,
  title,
  description,
  message,
  onRetry,
  retryText = 'Try Again',
  isRetrying = false,
  secondaryAction,
  icon,
  className = '',
  children
}) {
  // Parse error via centralized error parser if error prop is supplied
  const parsed = error ? parseApiError(error) : null;

  const displayTitle = title || parsed?.title || 'Unable to Load Content';
  const displayDescription = description || message || parsed?.message || 'We encountered an unexpected condition. Please try again.';

  return (
    <div
      className={`state-container ${className}`.trim()}
      role="alert"
      aria-live="assertive"
    >
      <div className="state-icon-box state-icon-danger" aria-hidden="true">
        {icon || (
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <h3 className="state-title">{displayTitle}</h3>

      <p className="state-description">{displayDescription}</p>

      {children && <div style={{ margin: 'var(--spacing-2) 0' }}>{children}</div>}

      {(onRetry || secondaryAction) && (
        <div
          className="state-action"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}
        >
          {onRetry && (
            <RetryButton
              onRetry={onRetry}
              isRetrying={isRetrying}
              label={retryText}
              variant="primary"
            />
          )}

          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export { ErrorState };
