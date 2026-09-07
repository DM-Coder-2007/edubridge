'use client';

import React, { useEffect, useRef, useId } from 'react';
import Button from './Button';

/**
 * Accessible Confirmation / Alert Dialog Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} props.onConfirm
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.confirmText='Confirm']
 * @param {string} [props.cancelText='Cancel']
 * @param {'danger' | 'info' | 'success'} [props.variant='info']
 * @param {boolean} [props.loading=false]
 */
export default function Dialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  loading = false
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousActiveElement = useRef(null);

  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // For dangerous dialogs, default focus to Cancel button for safety
      if (variant === 'danger' && cancelButtonRef.current) {
        cancelButtonRef.current.focus();
      } else {
        const focusable = dialogRef.current?.querySelectorAll('button');
        if (focusable && focusable.length > 0) focusable[0].focus();
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !loading) {
          onClose();
        }
        if (e.key === 'Tab' && dialogRef.current) {
          const buttons = dialogRef.current.querySelectorAll('button:not([disabled])');
          if (!buttons.length) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
          } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, onClose, loading, variant]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="modal-content dialog-content"
      >
        <div className={`dialog-icon dialog-icon-${variant}`} aria-hidden="true">
          {variant === 'danger' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {variant === 'info' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {variant === 'success' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>

        {description && (
          <p id={descId} className="dialog-description">
            {description}
          </p>
        )}

        <div className="dialog-actions">
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
