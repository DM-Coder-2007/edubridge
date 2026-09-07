'use client';

import React from 'react';

/**
 * Accessible Empty State Component
 *
 * Provides friendly, clear guidance when a list, filter, or data collection has no records.
 *
 * @param {Object} props
 * @param {string} [props.title='No items found'] - Main heading explaining empty state
 * @param {string} [props.description] - Helpful guidance or call-to-action details
 * @param {React.ReactNode} [props.icon] - Illustration or icon
 * @param {React.ReactNode} [props.action] - Primary call to action element (e.g. Button)
 * @param {React.ReactNode} [props.secondaryAction] - Optional secondary action
 * @param {string} [props.className='']
 * @param {React.ReactNode} [props.children]
 */
export default function EmptyState({
  title = 'No items found',
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  children
}) {
  const safeTitle = title && title !== 'undefined' && title !== 'null' ? title : 'No records available';
  const safeDescription = description && description !== 'undefined' && description !== 'null' ? description : '';

  return (
    <div
      className={`state-container ${className}`.trim()}
      role="region"
      aria-label={safeTitle}
    >
      <div className="state-icon-box state-icon-neutral" aria-hidden="true">
        {icon || (
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        )}
      </div>

      <h3 className="state-title">{safeTitle}</h3>

      {safeDescription && <p className="state-description">{safeDescription}</p>}

      {children && <div style={{ margin: 'var(--spacing-2) 0' }}>{children}</div>}

      {(action || secondaryAction) && (
        <div
          className="state-action"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}
        >
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
