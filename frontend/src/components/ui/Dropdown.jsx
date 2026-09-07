'use client';

import React, { useState, useRef, useEffect, useId } from 'react';

/**
 * Accessible Dropdown Menu Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Trigger button or element
 * @param {Array<{ label?: string, icon?: React.ReactNode, onClick?: function, danger?: boolean, disabled?: boolean, divider?: boolean }>} props.items
 * @param {'left' | 'right'} [props.align='right']
 * @param {string} [props.className='']
 */
export default function Dropdown({
  trigger,
  items = [],
  align = 'right',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleTriggerClick = () => {
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const menuItems = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])');
        if (menuItems && menuItems.length > 0) {
          const currentIndex = Array.from(menuItems).indexOf(document.activeElement);
          const nextIndex = (currentIndex + 1) % menuItems.length;
          menuItems[nextIndex].focus();
        }
      }
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault();
      const menuItems = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])');
      if (menuItems && menuItems.length > 0) {
        const currentIndex = Array.from(menuItems).indexOf(document.activeElement);
        const prevIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        menuItems[prevIndex].focus();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`dropdown-container ${className}`.trim()}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTriggerClick();
          }
        }}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="dropdown-menu"
          style={align === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' }}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`divider-${idx}`} className="dropdown-divider" role="separator" />;
            }

            return (
              <button
                key={`item-${idx}`}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  if (item.onClick) item.onClick();
                  triggerRef.current?.focus();
                }}
                className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`.trim()}
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
