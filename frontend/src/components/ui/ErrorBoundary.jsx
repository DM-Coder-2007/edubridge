'use client';

import React from 'react';
import Button from './Button';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript rendering errors anywhere in child components.
 * Prevents blank white screens and provides an accessible recovery interface.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Uncaught rendering exception:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            minHeight: '380px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-8) var(--spacing-4)',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '2px solid var(--color-danger-500)',
            borderRadius: 'var(--radius-lg)',
            margin: 'var(--spacing-6) auto',
            maxWidth: '640px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-danger-100)',
              color: 'var(--color-danger-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--spacing-4)'
            }}
            aria-hidden="true"
          >
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
          </div>

          <h2 className="text-h2" style={{ marginBottom: 'var(--spacing-2)' }}>
            Something interrupted this view
          </h2>

          <p
            className="text-body"
            style={{ color: 'var(--text-secondary)', maxWidth: '480px', marginBottom: 'var(--spacing-6)' }}
          >
            EduBridge encountered an unexpected interface issue while displaying this section. Your progress and data are safe.
          </p>

          <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="primary" onClick={this.handleReset}>
              Reload Interface
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard';
                }
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
