'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardBody, Button, Badge, ProgressBar } from '../ui';

export function QuizSummary({
  lessonId,
  history = [],
  onRetake
}) {
  const totalAnswered = history.length;
  const correctCount = history.filter((h) => h.isCorrect).length;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const finalMastery = history.length > 0 ? history[history.length - 1].mastery || accuracy : 0;

  return (
    <Card>
      <CardBody>
        <div className="stack-lg text-center" style={{ padding: 'var(--spacing-4) 0' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(22, 163, 74, 0.12)',
              color: 'var(--color-success-600)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <div className="stack-xs">
            <h2 className="text-h2">Assessment Completed!</h2>
            <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
              Great effort working through the adaptive assessment questions.
            </p>
          </div>

          {/* Metric Summary Grid */}
          <div className="grid grid-cols-1 grid-cols-sm-3 gap-4" style={{ textAlign: 'left' }}>
            <div className="p-4" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div className="text-small" style={{ color: 'var(--text-muted)' }}>Questions Answered</div>
              <div className="text-h2" style={{ margin: 'var(--spacing-1) 0' }}>{totalAnswered}</div>
              <div className="text-caption" style={{ color: 'var(--color-primary-700)' }}>Adaptive session</div>
            </div>

            <div className="p-4" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div className="text-small" style={{ color: 'var(--text-muted)' }}>Accuracy</div>
              <div className="text-h2" style={{ margin: 'var(--spacing-1) 0' }}>{accuracy}%</div>
              <div className="text-caption" style={{ color: 'var(--color-success-600)' }}>{correctCount} of {totalAnswered} correct</div>
            </div>

            <div className="p-4" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div className="text-small" style={{ color: 'var(--text-muted)' }}>Updated Mastery</div>
              <div className="text-h2" style={{ margin: 'var(--spacing-1) 0' }}>{finalMastery}%</div>
              <div className="text-caption" style={{ color: 'var(--color-accent-700)' }}>Stored in Snowflake</div>
            </div>
          </div>

          {/* Mastery Progress Bar */}
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
            <div className="flex justify-between items-center text-small font-semibold" style={{ marginBottom: 'var(--spacing-2)' }}>
              <span>Curriculum Concept Mastery</span>
              <span className="text-primary">{finalMastery}%</span>
            </div>
            <ProgressBar
              value={finalMastery}
              label="Overall concept mastery"
              variant={finalMastery >= 85 ? 'success' : 'primary'}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-center items-center gap-4 flex-wrap" style={{ marginTop: 'var(--spacing-4)' }}>
            <Link href={`/lessons/${lessonId}`}>
              <Button variant="primary" size="lg">
                <span>Review Lesson Content</span>
              </Button>
            </Link>

            <Button variant="outline" size="lg" onClick={onRetake}>
              <span>Practice More Questions</span>
            </Button>

            <Link href="/lessons">
              <Button variant="ghost" size="lg">
                <span>Return to Library</span>
              </Button>
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
