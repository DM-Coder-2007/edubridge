'use client';

import React from 'react';
import { Badge, Card, CardBody } from '../ui';
import { ConceptCard } from './ConceptCard';
import { getOptimizedDiagramUrl } from '../../lib/cloudinary';

/**
 * Safely parses raw text or structured paragraphs without unsafe HTML injection
 */
function renderSafeText(text) {
  if (!text || typeof text !== 'string') return null;

  // Split by double newlines into clean paragraph elements
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map((p, idx) => {
    const trimmed = p.trim();
    if (!trimmed) return null;
    return (
      <p key={idx} className="lesson-body-text" style={{ marginBottom: 'var(--spacing-3)' }}>
        {trimmed}
      </p>
    );
  });
}

export function LessonContent({
  lesson,
  textbook,
  concepts = [],
  masteryScores = {}
}) {
  const title = lesson.title || 'Accessible Lesson';
  const summary = lesson.summary;
  const mainExplanation = lesson.simplifiedText || lesson.screenReaderTranscript;
  const sensoryAnalogies = lesson.sensoryAnalogies || [];
  const keyTakeaways = lesson.keyTakeaways || [];

  // Metadata from associated textbook scan if available
  const tbMetadata = textbook?.metadata || {};
  const formulas = tbMetadata.formulas || [];
  const examples = tbMetadata.examples || [];
  const diagramDescriptions = tbMetadata.diagramDescriptions || [];
  const accessibleImageUrl =
    textbook?.accessibleImageUrl || textbook?.processedImageUrl || textbook?.rawImageUrl;

  // Combine concepts from lesson takeaways and textbook concepts
  const resolvedConcepts =
    concepts.length > 0
      ? concepts
      : tbMetadata.concepts && tbMetadata.concepts.length > 0
      ? tbMetadata.concepts
      : keyTakeaways.map((k, i) => ({
          id: `takeaway-${i}`,
          name: typeof k === 'string' ? k : k.name,
          explanation: typeof k === 'string' ? k : k.explanation,
          difficultyLevel: 'medium'
        }));

  return (
    <div className="stack-lg">
      {/* 1. Summary Callout */}
      {summary && (
        <section id="lesson-overview" aria-label="Lesson Overview">
          <div className="lesson-summary-banner">
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--spacing-1)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--color-primary-600)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <h2 className="text-small font-semibold" style={{ color: 'var(--color-primary-700)' }}>
                Executive Summary
              </h2>
            </div>
            <p className="text-body" style={{ color: 'var(--text-primary)', margin: 0 }}>
              {summary}
            </p>
          </div>
        </section>
      )}

      {/* 2. Main AI-Generated Explanation */}
      <section id="lesson-explanation" className="lesson-section-card" aria-label="Core Lesson Explanation">
        <h2 className="text-h2">Core Explanation</h2>
        <div className="lesson-body-text">
          {renderSafeText(mainExplanation)}
        </div>

        {/* Sensory / Tactile Analogies Block */}
        {sensoryAnalogies.length > 0 && (
          <div className="sensory-analogy-box" style={{ marginTop: 'var(--spacing-4)' }}>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--color-accent-700)' }}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <h3 className="text-h3" style={{ fontSize: '1.15rem', color: 'var(--color-accent-700)', margin: 0 }}>
                Sensory & Tactile Analogies
              </h3>
            </div>
            <div className="stack-sm">
              {sensoryAnalogies.map((analogy, i) => (
                <div key={i} className="text-body" style={{ color: 'var(--text-secondary)' }}>
                  {typeof analogy === 'string' ? analogy : analogy.analogy || analogy.description}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Formulas Section (where provided) */}
      {formulas.length > 0 && (
        <section id="lesson-formulas" className="lesson-section-card" aria-label="Mathematical & Scientific Formulas">
          <h2 className="text-h2">Key Formulas & Equations</h2>
          <div className="grid grid-cols-1 grid-cols-md-2 gap-4">
            {formulas.map((f, i) => (
              <div key={i} className="formula-card">
                <div className="font-semibold text-primary">{f.name || `Formula ${i + 1}`}</div>
                <div
                  className="text-h3 font-mono"
                  style={{ margin: 'var(--spacing-2) 0', color: 'var(--text-primary)' }}
                >
                  {f.formula || f.equation}
                </div>
                {f.explanation && (
                  <p className="text-caption" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {f.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Visual Content & Spatial Tactile Diagrams */}
      {(accessibleImageUrl || diagramDescriptions.length > 0) && (
        <section id="lesson-diagrams" className="lesson-section-card" aria-label="Diagrams and Visual Content">
          <h2 className="text-h2">Visual Content & Tactile Descriptions</h2>
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
            High-contrast Cloudinary scan coupled with spatial descriptions for non-visual comprehension.
          </p>

          {accessibleImageUrl && (
            <div className="lesson-diagram-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getOptimizedDiagramUrl(accessibleImageUrl, 1200)}
                alt={`Accessible high-contrast diagram for ${title}`}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          {diagramDescriptions.length > 0 && (
            <div className="stack-md" style={{ marginTop: 'var(--spacing-3)' }}>
              {diagramDescriptions.map((d, i) => (
                <div key={i} className="p-4" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <Badge variant="accent">Spatial Diagram {d.figureIndex || i + 1}</Badge>
                    {d.caption && <span className="font-semibold text-small">{d.caption}</span>}
                  </div>
                  <p className="text-body" style={{ color: 'var(--text-primary)' }}>
                    {d.tactileDescription || d.audioDescription || d.spatialLayout}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5. Expandable Concepts Section */}
      {resolvedConcepts.length > 0 && (
        <section id="lesson-concepts" className="lesson-section-card" aria-label="Key Concepts">
          <div className="flex items-center justify-between">
            <h2 className="text-h2">Expandable Concept Breakdown</h2>
            <Badge variant="secondary">{resolvedConcepts.length} Concepts Tracked</Badge>
          </div>

          <div className="concept-accordion-list">
            {resolvedConcepts.map((concept, idx) => (
              <ConceptCard
                key={concept.id || idx}
                concept={concept}
                index={idx}
                masteryScore={masteryScores[concept.id || concept.name]}
              />
            ))}
          </div>
        </section>
      )}

      {/* 6. Practical Examples (where provided) */}
      {examples.length > 0 && (
        <section id="lesson-examples" className="lesson-section-card" aria-label="Worked Examples">
          <h2 className="text-h2">Worked Examples</h2>
          <div className="stack-md">
            {examples.map((ex, i) => (
              <div key={i} className="p-4" style={{ backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success-600)' }}>
                <h3 className="text-h3 font-semibold" style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-2)' }}>
                  {ex.title || `Example ${i + 1}`}
                </h3>
                {ex.problem && (
                  <p className="text-body" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <strong>Problem:</strong> {ex.problem}
                  </p>
                )}
                {ex.solution && (
                  <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                    <strong>Solution:</strong> {ex.solution}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
