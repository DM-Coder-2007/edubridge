'use client';

import React from 'react';
import { Badge } from '../ui';

/**
 * Progress Overview Summary Cards
 * Displays:
 * - Overall Mastery Score
 * - Lessons Completed
 * - Questions / Attempts Answered
 * - Learning Streak / Concepts Tracked
 */
export function ProgressOverview({
  overview = {},
  progressSummary = {}
}) {
  const overallMastery = overview.overallMasteryScore ?? 0;
  const completedLessons = progressSummary.completedLessons ?? 0;
  const totalLessons = progressSummary.totalLessons ?? overview.totalLessons ?? 0;
  const totalQuestions = overview.totalAttempts ?? 0;
  const totalConcepts = overview.totalConceptsTracked ?? 0;

  let masteryVariant = 'primary';
  if (overallMastery >= 80) masteryVariant = 'success';
  else if (overallMastery < 60) masteryVariant = 'warning';

  return (
    <section className="progress-metrics-grid" aria-label="Learning metrics overview">
      {/* 1. Overall Mastery Card */}
      <div className="progress-metric-card">
        <div className="progress-metric-label">Overall Mastery</div>
        <div className="progress-metric-value" style={{ color: overallMastery >= 80 ? 'var(--color-success-700)' : 'var(--color-primary-700)' }}>
          {overallMastery}%
        </div>
        <div className="progress-metric-footer">
          <Badge variant={masteryVariant}>
            {overallMastery >= 80 ? 'Proficient / Strong' : overallMastery >= 60 ? 'Developing' : 'Foundational'}
          </Badge>
        </div>
      </div>

      {/* 2. Lessons Completed Card */}
      <div className="progress-metric-card">
        <div className="progress-metric-label">Lessons Completed</div>
        <div className="progress-metric-value">
          {completedLessons}
          <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            {' '}/ {totalLessons}
          </span>
        </div>
        <div className="progress-metric-footer">
          {totalLessons > 0 ? `${Math.round((completedLessons / totalLessons) * 100)}% completion rate` : 'No lessons yet'}
        </div>
      </div>

      {/* 3. Questions / Assessments Answered */}
      <div className="progress-metric-card">
        <div className="progress-metric-label">Questions Evaluated</div>
        <div className="progress-metric-value">{totalQuestions}</div>
        <div className="progress-metric-footer">
          Multi-turn AI comprehension checks
        </div>
      </div>

      {/* 4. Concepts Mastered / Tracked */}
      <div className="progress-metric-card">
        <div className="progress-metric-label">Concepts Tracked</div>
        <div className="progress-metric-value">{totalConcepts}</div>
        <div className="progress-metric-footer">
          {overview.masteredConceptsCount || 0} fully mastered in Snowflake
        </div>
      </div>
    </section>
  );
}

export default ProgressOverview;
