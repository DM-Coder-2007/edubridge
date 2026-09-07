'use client';

import React from 'react';
import { Card, CardBody, ProgressBar } from '../ui';

const STEPS = [
  { key: 'uploading', label: 'Uploading textbook' },
  { key: 'preparing_image', label: 'Preparing image' },
  { key: 'extracting_content', label: 'Extracting content' },
  { key: 'building_lesson', label: 'Building lesson' },
  { key: 'generating_questions', label: 'Generating questions' },
  { key: 'preparing_audio', label: 'Preparing learning experience' }
];

export function ProcessingProgress({ stepStatuses }) {
  // Calculate percentage of completed steps
  const completedCount = STEPS.filter((s) => stepStatuses[s.key] === 'completed').length;
  const progressPercent = Math.round((completedCount / STEPS.length) * 100);

  const getStepIndicator = (status) => {
    if (status === 'completed') {
      return (
        <span
          className="upload-step-indicator upload-step-indicator--completed"
          aria-label="Completed"
          title="Completed"
        >
          ✓
        </span>
      );
    }
    if (status === 'active') {
      return (
        <span
          className="upload-step-indicator upload-step-indicator--active"
          aria-label="In progress"
          title="In progress"
        >
          ●
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span
          className="upload-step-indicator text-danger font-bold"
          aria-label="Failed"
          title="Failed"
        >
          ✕
        </span>
      );
    }
    return (
      <span
        className="upload-step-indicator upload-step-indicator--pending"
        aria-label="Pending"
        title="Pending"
      >
        ○
      </span>
    );
  };

  return (
    <Card className="upload-steps-card">
      <CardBody>
        <div className="stack">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Processing Textbook Scan</h2>
            <span className="text-small font-medium" style={{ color: 'var(--color-primary-700)' }}>
              {progressPercent}%
            </span>
          </div>

          <ProgressBar
            value={progressPercent}
            label="Overall processing progress"
            color="primary"
          />

          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Our AI engine and Piper TTS are analyzing your textbook page, extracting diagrams, generating accessible lessons, and creating audio narration.
          </p>

          <ol className="upload-steps-list" aria-label="Processing stages">
            {STEPS.map((step, idx) => {
              const status = stepStatuses[step.key] || 'pending';
              return (
                <li
                  key={step.key}
                  className={`upload-step-item upload-step-item--${status}`}
                  aria-current={status === 'active' ? 'step' : undefined}
                >
                  <div className="upload-step-content">
                    <span className="text-caption" style={{ color: 'var(--text-muted)', width: '20px' }}>
                      {idx + 1}.
                    </span>
                    <span className="upload-step-name">{step.label}</span>
                  </div>
                  {getStepIndicator(status)}
                </li>
              );
            })}
          </ol>
        </div>
      </CardBody>
    </Card>
  );
}
