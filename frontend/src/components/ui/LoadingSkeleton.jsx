'use client';

import React from 'react';
import Skeleton from './Skeleton';

/**
 * LoadingSkeleton Component
 *
 * Accessible placeholder loading system that prevents layout shift (CLS)
 * and announces loading progress to assistive screen readers.
 *
 * Presets:
 * - 'page': Full-page header and grid skeleton
 * - 'card': Standard educational card skeleton
 * - 'list': Stacked list item skeletons
 * - 'table': Tabular row skeletons
 * - 'text': Multi-line paragraph skeleton
 * - 'rect' | 'circle': Primitive skeletons
 */
export default function LoadingSkeleton({
  preset = 'text',
  count = 1,
  height,
  width,
  className = '',
  ariaLabel = 'Loading content...'
}) {
  // 1. Full Page Preset
  if (preset === 'page') {
    return (
      <div
        className={`stack-lg ${className}`.trim()}
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
      >
        <span className="sr-only">{ariaLabel}</span>
        {/* Header Skeleton */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="stack-xs" style={{ width: '60%' }}>
            <Skeleton variant="text" width="40%" height={32} />
            <Skeleton variant="text" width="75%" height={18} />
          </div>
          <Skeleton variant="rect" height={40} width={150} />
        </div>

        {/* Metric Cards Skeleton Grid */}
        <div className="grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-5)'
              }}
            >
              <Skeleton variant="text" width="50%" height={16} />
              <div style={{ margin: 'var(--spacing-2) 0' }}>
                <Skeleton variant="rect" height={36} width="35%" />
              </div>
              <Skeleton variant="text" width="80%" height={14} />
            </div>
          ))}
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 grid-cols-md-2 gap-6">
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-6)'
            }}
          >
            <Skeleton variant="text" width="45%" height={24} />
            <div style={{ margin: 'var(--spacing-4) 0' }}>
              <Skeleton variant="rect" height={160} />
            </div>
            <Skeleton variant="rect" height={38} width={140} />
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-6)'
            }}
          >
            <Skeleton variant="text" width="40%" height={24} />
            <div className="stack-sm" style={{ margin: 'var(--spacing-4) 0' }}>
              <Skeleton variant="rect" height={48} />
              <Skeleton variant="rect" height={48} />
              <Skeleton variant="rect" height={48} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Card Preset (e.g. Lesson Cards, Concept Cards)
  if (preset === 'card') {
    const cards = Array.from({ length: Math.max(1, count) }, (_, i) => i);
    return (
      <div
        className={`grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-3 gap-6 ${className}`.trim()}
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
      >
        <span className="sr-only">{ariaLabel}</span>
        {cards.map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-3)'
            }}
          >
            <Skeleton variant="rect" height={140} />
            <Skeleton variant="text" width="70%" height={22} />
            <Skeleton variant="text" width="90%" height={16} />
            <Skeleton variant="text" width="50%" height={16} />
            <div style={{ marginTop: 'auto', paddingTop: 'var(--spacing-3)' }}>
              <Skeleton variant="rect" height={38} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3. List Items Preset
  if (preset === 'list') {
    const rows = Array.from({ length: Math.max(1, count) }, (_, i) => i);
    return (
      <div
        className={`stack-sm ${className}`.trim()}
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
      >
        <span className="sr-only">{ariaLabel}</span>
        {rows.map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-4)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              gap: 'var(--spacing-4)'
            }}
          >
            <div className="stack-xs" style={{ flexGrow: 1 }}>
              <Skeleton variant="text" width="40%" height={18} />
              <Skeleton variant="text" width="60%" height={14} />
            </div>
            <Skeleton variant="rect" height={32} width={80} />
          </div>
        ))}
      </div>
    );
  }

  // 4. Default / Text Line Preset
  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
      <Skeleton
        variant={preset === 'circle' || preset === 'rect' ? preset : 'text'}
        count={count}
        height={height}
        width={width}
      />
    </div>
  );
}

export { LoadingSkeleton };
