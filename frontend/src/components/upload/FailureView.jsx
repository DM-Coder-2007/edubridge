'use client';

import React from 'react';
import { Card, CardBody, Button } from '../ui';
import { parseApiError } from '../../lib/errorParser';

export function FailureView({
  error,
  file,
  onRetry,
  onChooseAnother
}) {
  const parsed = parseApiError(error, {
    title: 'Textbook Processing Interrupted',
    message: 'We were unable to complete the upload and OCR analysis. Please try again with this scan or choose a different image.'
  });

  return (
    <Card className="upload-failure-card" style={{ borderColor: 'var(--color-danger-500)' }}>
      <CardBody>
        <div className="stack" role="alert" aria-live="assertive">
          <div className="flex items-center gap-3" style={{ color: 'var(--color-danger-600)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 className="text-h2" style={{ fontSize: '1.4rem' }}>
              {parsed.title}
            </h2>
          </div>

          <div
            style={{
              padding: 'var(--spacing-4)',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(220, 38, 38, 0.2)'
            }}
          >
            <p className="text-body font-medium" style={{ color: 'var(--color-danger-700)' }}>
              {parsed.message}
            </p>
          </div>

          {file && (
            <p className="text-small" style={{ color: 'var(--text-muted)' }}>
              Your selected image <strong>{file.name}</strong> is retained. You can retry the upload or choose another image file.
            </p>
          )}

          <div className="flex gap-3 items-center flex-wrap" style={{ marginTop: 'var(--spacing-2)' }}>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onRetry}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>{parsed.action || 'Retry Upload'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onChooseAnother}
            >
              Choose another image
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default FailureView;
