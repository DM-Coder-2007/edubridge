'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, Button } from '../ui';

export function LessonQuestions({ lessonId, questions = [], completedCount = 0 }) {
  const totalQuestions = questions.length;

  return (
    <section id="lesson-questions" className="lesson-section-card" aria-label="Comprehension Questions">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-h2">Comprehension Questions</h2>
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
            Reinforce mastery with AI-evaluated voice and multiple-choice questions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary">{totalQuestions} Questions Available</Badge>
          {completedCount > 0 && (
            <Badge variant="success">{completedCount} Answered</Badge>
          )}
        </div>
      </div>

      {totalQuestions === 0 ? (
        <div className="p-4 text-center text-muted" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
          No comprehension questions generated yet.
        </div>
      ) : (
        <div className="stack-md">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="question-item-card">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-small" style={{ color: 'var(--color-primary-700)' }}>
                  Question {idx + 1}
                </span>
                <Badge variant="outline">{q.questionType || 'Multiple Choice'}</Badge>
              </div>

              <p className="text-body font-medium" style={{ margin: 'var(--spacing-1) 0' }}>
                {q.questionText}
              </p>

              {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                <div className="grid grid-cols-1 grid-cols-sm-2 gap-2" style={{ marginTop: 'var(--spacing-1)' }}>
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      style={{
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--surface-tertiary)',
                        fontSize: 'var(--font-size-small)'
                      }}
                    >
                      <span className="font-mono font-bold" style={{ marginRight: 'var(--spacing-2)' }}>
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {q.audioPromptHint && (
                <div className="flex items-center gap-2 text-caption" style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="8" />
                  </svg>
                  <span>Hint: {q.audioPromptHint}</span>
                </div>
              )}
            </div>
          ))}

          {/* Interactive Quiz Mode CTA */}
          <div style={{ marginTop: 'var(--spacing-3)' }}>
            <Link href={`/lessons/${lessonId}/quiz`} style={{ display: 'inline-block' }}>
              <Button variant="primary" size="lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Launch Interactive Quiz Assessment</span>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
