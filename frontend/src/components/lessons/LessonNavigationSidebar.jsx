'use client';

import React from 'react';
import Link from 'next/link';
import { ProgressBar, Badge } from '../ui';

export function LessonNavigationSidebar({
  activeSection,
  onSectionClick,
  progressPercentage = 0,
  questionsAnswered = 0,
  totalQuestions = 0,
  masteryScore = 0,
  previousLessonId,
  nextLessonId,
  conceptCount = 0
}) {
  const navItems = [
    { id: 'lesson-overview', label: 'Overview & Summary', count: null },
    { id: 'lesson-explanation', label: 'Core Explanation', count: null },
    { id: 'lesson-concepts', label: 'Key Concepts', count: conceptCount },
    { id: 'lesson-diagrams', label: 'Visual & Diagrams', count: null },
    { id: 'lesson-questions', label: 'Questions', count: totalQuestions }
  ];

  return (
    <aside className="lesson-player-sidebar" aria-label="Lesson Outline & Learning Navigation">
      {/* 1. Outline Navigation */}
      <div className="lesson-nav-card">
        <div className="flex justify-between items-center">
          <h3 className="text-small font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Lesson Outline
          </h3>
          <Link href="/lessons" className="text-caption font-medium text-primary">
            ← Library
          </Link>
        </div>

        <nav aria-label="Lesson Sections">
          <ul className="lesson-nav-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={`lesson-nav-link ${activeSection === item.id ? 'lesson-nav-link--active' : ''}`}
                  onClick={() => onSectionClick(item.id)}
                >
                  <span>{item.label}</span>
                  {item.count !== null && item.count > 0 && (
                    <Badge variant="secondary" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                      {item.count}
                    </Badge>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* 2. Real Learning Progress Metrics */}
      <div className="lesson-nav-card">
        <h3 className="text-small font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Learning Progress
        </h3>

        <div className="lesson-progress-box">
          {/* Lesson Completion Progress */}
          <div>
            <div className="lesson-progress-row">
              <span style={{ color: 'var(--text-muted)' }}>Lesson Completion:</span>
              <span className="font-semibold">{progressPercentage}%</span>
            </div>
            <div style={{ marginTop: 'var(--spacing-1)' }}>
              <ProgressBar
                value={progressPercentage}
                label="Lesson Completion Progress"
                variant={progressPercentage >= 100 ? 'success' : 'primary'}
              />
            </div>
          </div>

          {/* Question Progress */}
          <div>
            <div className="lesson-progress-row">
              <span style={{ color: 'var(--text-muted)' }}>Questions Answered:</span>
              <span className="font-semibold">
                {questionsAnswered} of {totalQuestions}
              </span>
            </div>
            <div style={{ marginTop: 'var(--spacing-1)' }}>
              <ProgressBar
                value={totalQuestions > 0 ? Math.round((questionsAnswered / totalQuestions) * 100) : 0}
                label="Question Progress"
                variant="accent"
              />
            </div>
          </div>

          {/* Concept Mastery */}
          <div className="lesson-progress-row" style={{ paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Snowflake Mastery:</span>
            <span
              className="font-bold"
              style={{
                color:
                  masteryScore >= 85
                    ? 'var(--color-success-600)'
                    : masteryScore >= 60
                    ? 'var(--color-primary-600)'
                    : 'var(--color-warning-600)'
              }}
            >
              {masteryScore > 0 ? `${masteryScore}%` : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Flow Navigation */}
      <div className="flex gap-2">
        {previousLessonId ? (
          <Link href={`/lessons/${previousLessonId}`} style={{ flex: 1 }}>
            <button type="button" className="btn btn-outline btn-sm btn-full" aria-label="Previous lesson">
              ← Previous
            </button>
          </Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm btn-full" disabled aria-disabled="true">
            ← Previous
          </button>
        )}

        {nextLessonId ? (
          <Link href={`/lessons/${nextLessonId}`} style={{ flex: 1 }}>
            <button type="button" className="btn btn-primary btn-sm btn-full" aria-label="Next lesson">
              Next →
            </button>
          </Link>
        ) : (
          <Link href="/lessons" style={{ flex: 1 }}>
            <button type="button" className="btn btn-outline btn-sm btn-full">
              Back to Library
            </button>
          </Link>
        )}
      </div>
    </aside>
  );
}
