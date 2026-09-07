'use client';

import React from 'react';
import { Badge, ProgressBar } from '../ui';

export function EvaluationResult({
  result,
  question
}) {
  if (!result) return null;

  const isCorrect = Boolean(result.isCorrect);
  const feedbackText = result.feedback || question?.explanation || '';
  const adaptive = result.adaptive || {};
  const updatedMastery = adaptive.updatedMastery || {};
  const masteryScore = updatedMastery.masteryScore ?? 50;
  const masteryLevel = updatedMastery.masteryLevel || 'DEVELOPING';
  const delta = updatedMastery.delta || 0;
  const recommendedDifficulty = adaptive.recommendedDifficulty || result.recommendedNextDifficulty;
  const reinforcement = adaptive.reinforcementRequirement;
  const reinforcementContent = reinforcement?.content;
  const simplerExplanation = reinforcementContent?.simplerExplanation || null;
  const tactileAnalogy = reinforcementContent?.tactileAnalogy || null;
  const stepBreakdown = reinforcementContent?.stepByStepBreakdown || [];

  const hasAdaptiveScaffolding =
    !isCorrect ||
    Boolean(simplerExplanation) ||
    Boolean(tactileAnalogy) ||
    Boolean(recommendedDifficulty);

  return (
    <div className="stack-md" role="region" aria-label="Question Evaluation Result" aria-live="polite">
      {/* 1. Result Banner */}
      <div
        className={`quiz-result-banner ${isCorrect ? 'quiz-result-banner--correct' : 'quiz-result-banner--incorrect'}`}
      >
        <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
          {isCorrect ? '✓' : '✕'}
        </span>
        <span>{isCorrect ? '✓ Great work!' : 'Not quite.'}</span>
      </div>

      {/* 2. Backend Explanation */}
      {feedbackText && (
        <div className="quiz-explanation-box">
          <div className="font-semibold text-small" style={{ marginBottom: 'var(--spacing-1)', color: 'var(--color-primary-700)' }}>
            Explanation
          </div>
          <p style={{ margin: 0 }}>{feedbackText}</p>
        </div>
      )}

      {/* 3. Visually Distinct Adaptive Feedback Panel */}
      {hasAdaptiveScaffolding && (
        <div className="adaptive-feedback-panel" aria-label="Adaptive Feedback & Cognitive Scaffolding">
          <div className="adaptive-feedback-header">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <h3 className="text-h3" style={{ fontSize: '1.15rem', margin: 0, color: 'inherit' }}>
              Adaptive Learning Scaffolding
            </h3>
          </div>

          <div className="stack-sm">
            {/* Simpler Explanation */}
            {simplerExplanation && (
              <div className="adaptive-reinforcement-item">
                <span className="font-semibold text-small text-accent">Simplified Explanation:</span>
                <p className="text-body" style={{ margin: 0 }}>
                  {simplerExplanation}
                </p>
              </div>
            )}

            {/* Tactile / Sensory Analogy */}
            {tactileAnalogy && (
              <div className="adaptive-reinforcement-item">
                <span className="font-semibold text-small text-primary">Tactile & Real-World Analogy:</span>
                <p className="text-body" style={{ margin: 0 }}>
                  {tactileAnalogy}
                </p>
              </div>
            )}

            {/* Step-by-Step Breakdown */}
            {stepBreakdown.length > 0 && (
              <div className="adaptive-reinforcement-item">
                <span className="font-semibold text-small">Step-by-Step Reasoning:</span>
                <ol style={{ paddingLeft: 'var(--spacing-4)', margin: 'var(--spacing-1) 0 0' }}>
                  {stepBreakdown.map((step, idx) => (
                    <li key={idx} className="text-small" style={{ marginBottom: '2px' }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Recommended Difficulty Shift */}
            {recommendedDifficulty && (
              <div className="flex items-center justify-between flex-wrap gap-2" style={{ paddingTop: 'var(--spacing-2)' }}>
                <span className="text-small font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Recommended Next Difficulty:
                </span>
                <Badge variant={isCorrect ? 'success' : 'accent'}>
                  {recommendedDifficulty.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Mastery Update Card (Exclusively from Backend Data) */}
      <div className="quiz-mastery-card">
        <div className="stack-xs">
          <span className="text-small font-semibold text-muted">Concept mastery</span>
          <div className="flex items-center gap-3">
            <span className="quiz-mastery-score-badge">{masteryScore}%</span>
            <Badge variant={masteryScore >= 85 ? 'success' : masteryScore >= 60 ? 'primary' : 'secondary'}>
              {masteryLevel}
            </Badge>
            {delta !== 0 && (
              <span className="text-small font-bold" style={{ color: delta > 0 ? 'var(--color-success-600)' : 'var(--color-danger-600)' }}>
                {delta > 0 ? `+${delta}%` : `${delta}%`}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
          <ProgressBar
            value={masteryScore}
            label="Current concept mastery"
            variant={masteryScore >= 85 ? 'success' : 'primary'}
          />
        </div>
      </div>
    </div>
  );
}
