'use client';

import React, { useState } from 'react';
import { Badge } from '../ui';
import { formatConceptName } from '../../lib/formatters';

export function ConceptCard({ concept, index, masteryScore }) {
  const [isExpanded, setIsExpanded] = useState(index === 0); // First concept open by default

  const name = formatConceptName(concept);
  const explanation =
    concept.explanation ||
    concept.description ||
    concept.definition ||
    (typeof concept === 'string' ? concept : 'Core scientific concept covered in this lesson.');

  const analogy = concept.simplifiedAnalogy || concept.tactileAnalogy || concept.analogy || null;
  const difficulty = concept.difficultyLevel || concept.difficulty || 'medium';
  const mastery = masteryScore !== undefined ? masteryScore : null;

  const getDifficultyBadge = (diff) => {
    switch (diff.toLowerCase()) {
      case 'beginner':
      case 'easy':
        return <Badge variant="success">Beginner</Badge>;
      case 'advanced':
      case 'hard':
        return <Badge variant="danger">Advanced</Badge>;
      default:
        return <Badge variant="secondary">Intermediate</Badge>;
    }
  };

  const contentId = `concept-content-${concept.id || index}`;

  return (
    <div className={`concept-card ${isExpanded ? 'concept-card--expanded' : ''}`}>
      <button
        type="button"
        className="concept-card-trigger"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-3">
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isExpanded ? 'var(--color-primary-600)' : 'var(--surface-tertiary)',
              color: isExpanded ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              flexShrink: 0
            }}
          >
            {index + 1}
          </span>
          <span className="text-body font-semibold">{name}</span>
        </div>

        <div className="flex items-center gap-3">
          {getDifficultyBadge(difficulty)}

          {mastery !== null && (
            <span
              className="text-caption font-semibold"
              style={{
                color:
                  mastery >= 85
                    ? 'var(--color-success-600)'
                    : mastery >= 60
                    ? 'var(--color-primary-600)'
                    : 'var(--color-warning-600)'
              }}
            >
              {mastery}% Mastery
            </span>
          )}

          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-fast)'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div id={contentId} className="concept-card-body">
          {/* Main Explanation */}
          <div className="text-body" style={{ color: 'var(--text-primary)' }}>
            {explanation}
          </div>

          {/* Multi-sensory tactile analogy */}
          {analogy && (
            <div className="sensory-analogy-box" style={{ marginTop: 'var(--spacing-2)' }}>
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--color-accent-700)' }}>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-small font-semibold" style={{ color: 'var(--color-accent-700)' }}>
                  Tactile / Real-World Analogy
                </span>
              </div>
              <p className="text-small" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                {analogy}
              </p>
            </div>
          )}

          {/* Visual Cue or Audio Hint if provided */}
          {concept.visualCue && (
            <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
              <strong>Visual Layout:</strong> {concept.visualCue}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
