import React from 'react';

/**
 * Accessible Skeleton Loader Component
 *
 * @param {Object} props
 * @param {'text' | 'rect' | 'circle'} [props.variant='text']
 * @param {string|number} [props.width]
 * @param {string|number} [props.height]
 * @param {number} [props.count=1]
 * @param {string} [props.className='']
 */
export default function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1,
  className = ''
}) {
  const items = Array.from({ length: Math.max(1, count) }, (_, i) => i);

  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const variantClass = `skeleton-${variant}`;

  return (
    <>
      {items.map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className={`skeleton ${variantClass} ${className}`.trim()}
          style={style}
        />
      ))}
    </>
  );
}
