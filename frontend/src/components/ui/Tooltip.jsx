'use client';

import React, { useState, useId } from 'react';

/**
 * Accessible Tooltip Component
 *
 * @param {Object} props
 * @param {string} props.text - Tooltip label
 * @param {React.ReactNode} props.children - Trigger element
 * @param {'top' | 'bottom'} [props.position='top']
 * @param {string} [props.className='']
 */
export default function Tooltip({
  text,
  children,
  position = 'top',
  className = ''
}) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  if (!text) return children;

  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isVisible) {
      setIsVisible(false);
    }
  };

  return (
    <div
      className={`tooltip-wrapper ${className}`.trim()}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={handleKeyDown}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="tooltip-bubble"
          style={position === 'bottom' ? { bottom: 'auto', top: 'calc(100% + 8px)' } : {}}
        >
          {text}
        </div>
      )}
    </div>
  );
}
