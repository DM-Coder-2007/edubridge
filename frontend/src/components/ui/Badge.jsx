import React from 'react';

/**
 * Accessible Badge / Tag Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'} [props.variant='neutral']
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className='']
 */
export default function Badge({
  children,
  variant = 'neutral',
  icon,
  className = '',
  ...rest
}) {
  return (
    <span
      className={`badge badge-${variant} ${className}`.trim()}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
