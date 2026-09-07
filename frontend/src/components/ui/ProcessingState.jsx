'use client';

import React from 'react';
import Spinner from './Spinner';
import ProgressBar from './ProgressBar';

/**
 * ProcessingState Component
 *
 * Dedicated accessible view for asynchronous, multi-phase operations
 * (e.g. Gemini Multimodal OCR, Piper TTS Synthesis, Adaptive Lesson Generation).
 *
 * @param {Object} props
 * @param {string} [props.title='Processing Content'] - Main operation heading
 * @param {string} [props.subtitle] - Detailed explanation or reassurance
 * @param {Array<{ label: string, status: 'pending'|'active'|'completed'|'error' }>} [props.steps] - Visual step tracker
 * @param {number} [props.progressPercent] - Optional 0-100 completion percentage
 * @param {string} [props.estimatedTime] - Optional duration estimate (e.g. "5–10 seconds")
 * @param {React.ReactNode} [props.cancelAction] - Optional cancel button
 * @param {string} [props.className='']
 */
export default function ProcessingState({
  title = 'Processing Content',
  subtitle = 'Analyzing and adapting learning materials with AI. Please keep this page open.',
  steps = [],
  progressPercent,
  estimatedTime,
  cancelAction,
  className = ''
}) {
  return (
    <div
      className={`state-container processing-state-container ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--spacing-3)'
        }}
      >
        <Spinner size="lg" ariaLabel={title} />
      </div>

      <h3 className="state-title">{title}</h3>

      {subtitle && <p className="state-description">{subtitle}</p>}

      {typeof progressPercent === 'number' && (
        <div style={{ width: '100%', maxWidth: '360px', margin: 'var(--spacing-4) auto' }}>
          <ProgressBar value={progressPercent} showLabel />
        </div>
      )}

      {/* Multi-step progression checklist if provided */}
      {Array.isArray(steps) && steps.length > 0 && (
        <div
          className="processing-steps-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-2)',
            width: '100%',
            maxWidth: '380px',
            margin: 'var(--spacing-4) auto 0',
            textAlign: 'left',
            padding: 'var(--spacing-4)',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isError = step.status === 'error';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-3)',
                  fontSize: 'var(--font-size-small)',
                  color: isCompleted
                    ? 'var(--color-success-700)'
                    : isActive
                    ? 'var(--color-primary-700)'
                    : isError
                    ? 'var(--color-danger-700)'
                    : 'var(--text-muted)',
                  fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-regular)'
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: isCompleted
                      ? 'var(--color-success-500)'
                      : isActive
                      ? 'var(--color-primary-600)'
                      : isError
                      ? 'var(--color-danger-500)'
                      : 'var(--color-neutral-300)',
                    color: 'var(--color-neutral-0)',
                    flexShrink: 0
                  }}
                  aria-hidden="true"
                >
                  {isCompleted ? '✓' : isError ? '✕' : isActive ? '●' : idx + 1}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {estimatedTime && (
        <div
          className="text-caption"
          style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-3)' }}
        >
          Estimated duration: {estimatedTime}
        </div>
      )}

      {cancelAction && (
        <div style={{ marginTop: 'var(--spacing-4)' }}>
          {cancelAction}
        </div>
      )}
    </div>
  );
}

export { ProcessingState };
