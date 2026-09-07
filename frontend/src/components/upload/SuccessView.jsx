'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardBody, Button, Badge } from '../ui';
import { getOptimizedThumbnailUrl } from '../../lib/cloudinary';

export function SuccessView({ result, onUploadAnother }) {
  const lesson = result?.lesson;
  const textbook = result?.textbook;
  const title = lesson?.title || textbook?.title || 'Accessible Lesson';
  const summary =
    lesson?.summary ||
    lesson?.simplifiedText?.slice(0, 240) + '...' ||
    'Multi-sensory accessible lesson with tactile analogies and neural TTS narration.';
  const conceptsCount = result?.conceptsCount ?? 0;
  const questionsCount = result?.questionsCount ?? 0;
  const previewImage =
    result?.accessibleImageUrl ||
    textbook?.accessibleImageUrl ||
    textbook?.processedImageUrl ||
    textbook?.rawImageUrl;
  const lessonId = lesson?.id || textbook?.id;

  return (
    <div className="upload-success-container">
      <div className="upload-success-header" role="status" aria-live="polite">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
        <h2 className="text-h2" style={{ color: 'var(--color-success-600)' }}>
          Lesson created successfully.
        </h2>
      </div>

      <div className="upload-result-card">
        <div className="upload-result-content">
          {/* Cloudinary-transformed accessible image thumbnail */}
          <div className="upload-result-media">
            {previewImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={getOptimizedThumbnailUrl(previewImage, 600)}
                alt={`Accessible scan view for ${title}`}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex items-center justify-center p-4 text-muted">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>

          {/* Lesson Metadata & Action Details */}
          <div className="upload-result-details">
            <div className="stack-sm">
              <div className="flex gap-2 items-center flex-wrap">
                <Badge variant="primary">{textbook?.subject || 'Science'}</Badge>
                {textbook?.chapterTitle && <Badge variant="secondary">{textbook.chapterTitle}</Badge>}
                <Badge variant="success">Cloudinary Synced</Badge>
                <Badge variant="accent">Piper TTS Narration Ready</Badge>
              </div>

              <h3 className="text-h2" style={{ fontSize: '1.5rem', marginTop: 'var(--spacing-1)' }}>
                {title}
              </h3>

              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                {summary}
              </p>

              <div className="flex gap-4 items-center flex-wrap" style={{ marginTop: 'var(--spacing-2)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>Concepts:</span>
                  <span className="font-semibold text-primary">{conceptsCount} identified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>Comprehension Questions:</span>
                  <span className="font-semibold text-accent">{questionsCount} generated</span>
                </div>
              </div>

              {/* Key Concept tags */}
              {textbook?.metadata?.concepts && textbook.metadata.concepts.length > 0 && (
                <div className="upload-concept-chips" aria-label="Key concepts extracted">
                  {textbook.metadata.concepts.slice(0, 5).map((c, i) => (
                    <Badge key={i} variant="outline">
                      {c.name || c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex gap-4 items-center flex-wrap" style={{ marginTop: 'var(--spacing-4)' }}>
              <Link href={`/lessons/${lessonId}`}>
                <Button variant="primary" size="lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Start Learning</span>
                </Button>
              </Link>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onUploadAnother}
              >
                Upload Another Textbook
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
