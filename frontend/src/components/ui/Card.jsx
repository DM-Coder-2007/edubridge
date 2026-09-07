import React from 'react';

/**
 * Accessible Card Container Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.interactive=false]
 * @param {string} [props.className='']
 * @param {React.ElementType} [props.as='div']
 */
export default function Card({
  children,
  interactive = false,
  className = '',
  as: Component = 'div',
  ...rest
}) {
  return (
    <Component
      className={`card ${interactive ? 'card-interactive' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = '', ...rest }) {
  return (
    <div className={`card-header ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', as: Component = 'h3', ...rest }) {
  return (
    <Component className={`text-h3 ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}

export function CardDescription({ children, className = '', ...rest }) {
  return (
    <p className={`text-small ${className}`.trim()} {...rest}>
      {children}
    </p>
  );
}

export function CardBody({ children, className = '', ...rest }) {
  return (
    <div className={`card-body ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...rest }) {
  return (
    <div className={`card-footer ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
