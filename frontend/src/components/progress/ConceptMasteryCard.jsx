'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, ProgressBar, Button } from '../ui';

/**
 * Visual Concept Mastery Card
 * Example mandated by design:
 * Photosynthesis
 * 82%
 * Strong
 * [ProgressBar]
 */
export function ConceptMasteryCard({
  concept,
  onPractice
}) {
  const name = concept.conceptName || concept.conceptId || concept.name || 'Core Concept';
  const score = Math.round(concept.masteryScore ?? concept.score ?? 0);
  const attempts = concept.attemptsCount ?? concept.attempts ?? 0;
  const lastPracticed = concept.lastPracticedAt ? new Date(concept.lastPracticedAt).toLocaleDateString() : 'Recently';

  // Determine mastery label & variant
  let statusLabel = 'Developing';
  let badgeVariant = 'primary';
  let progressVariant = 'primary';

  if (score >= 80) {
    statusLabel = 'Strong';
    badgeVariant = 'success';
    progressVariant = 'success';
  } else if (score < 60) {
    statusLabel = 'Needs Practice';
    badgeVariant = 'danger';
    progressVariant = 'danger';
  } else {
    statusLabel = 'Developing';
    badgeVariant = 'warning';
    progressVariant = 'primary';
  }

  return (
    <article className="concept-card" aria-label={`Concept: ${name}, Score: ${score} percent, Status: ${statusLabel}`}>
      {/* Header: Title and Status Badge */}
      <div className="concept-card-header">
        <h3 className="concept-card-title">{name}</h3>
        <Badge variant={badgeVariant}>{statusLabel}</Badge>
      </div>

      {/* Score Row */}
      <div className="concept-card-score-row">
        <span className="concept-card-score">{score}%</span>
        <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
          {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
        </span>
      </div>

      {/* Visual Progress Bar */}
      <ProgressBar
        value={score}
        max={100}
        variant={progressVariant}
        label={`Mastery progress for ${name}`}
      />

      {/* Footer: Last activity + Practice Action if needed */}
      <div className="concept-card-footer">
        <span>Practiced: {lastPracticed}</span>
        {score < 80 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPractice && onPractice(concept)}
            style={{ fontSize: '0.75rem', padding: '2px 8px', minHeight: '26px' }}
          >
            Practice
          </Button>
        )}
      </div>
    </article>
  );
}

export default ConceptMasteryCard;
