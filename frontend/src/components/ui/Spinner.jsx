import React from 'react';

/**
 * Accessible Loading Spinner Component
 *
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {string} [props.color='currentColor']
 * @param {string} [props.label='Loading...']
 * @param {string} [props.className='']
 */
export default function Spinner({
  size = 'md',
  color = 'currentColor',
  label = 'Loading...',
  className = ''
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`spinner spinner-${size} ${className}`.trim()}
      style={{ color }}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
