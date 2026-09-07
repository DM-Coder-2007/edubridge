'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { Badge, Button, ProgressBar } from '../ui';
import { formatDate, formatRelativeTime } from '../../lib/formatters';
import { getOptimizedThumbnailUrl } from '../../lib/cloudinary';

function LessonCardComponent({ lesson }) {
  const lessonId = lesson.id || lesson.lessonId;
  const title = lesson.title || 'Accessible Lesson';
  const subject = lesson.subject || 'General Science';
  const chapterTitle = lesson.chapterTitle;
  const progress = Math.min(100, Math.max(0, lesson.progress || lesson.completionPercentage || 0));
  const mastery = Math.min(100, Math.max(0, lesson.masteryScore || 0));
  const conceptCount = lesson.conceptCount || 3;
  const status = lesson.status || 'PUBLISHED';
  const hasAudio = Boolean(lesson.hasAudio);
  const audioDurationSeconds = lesson.audioDurationSeconds || 0;
  const optimizedThumbnailUrl = getOptimizedThumbnailUrl(lesson.thumbnailUrl, 500);
  const createdAt = formatDate(lesson.createdAt);
  const lastActivity = formatRelativeTime(lesson.lastActivity || lesson.updatedAt || lesson.createdAt);

  const getStatusBadge = () => {
    if (progress >= 100 || status === 'COMPLETED') {
      return <Badge variant="success">Completed</Badge>;
    }
    if (progress > 0 || status === 'IN_PROGRESS') {
      return <Badge variant="accent">In Progress</Badge>;
    }
    return <Badge variant="primary">Ready to Learn</Badge>;
  };

  const getMasteryColor = () => {
    if (mastery >= 85) return 'var(--color-success-600)';
    if (mastery >= 60) return 'var(--color-primary-600)';
    if (mastery > 0) return 'var(--color-warning-600)';
    return 'var(--text-muted)';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <article className="lesson-card" aria-label={`Lesson: ${title}`}>
      {/* Card Media Header */}
      <div className="lesson-card-media">
        {optimizedThumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={optimizedThumbnailUrl}
            alt={`Cover scan for ${title}`}
            className="lesson-card-img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="lesson-card-placeholder-media" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="text-caption font-medium">{subject}</span>
          </div>
        )}

        {/* Overlay Badges */}
        <div className="lesson-card-badge-row">
          <Badge variant="secondary">{subject}</Badge>
          {getStatusBadge()}
        </div>

        {/* Audio Pill */}
        {hasAudio && (
          <div className="lesson-card-audio-pill" aria-label="Audio narration ready">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>{formatDuration(audioDurationSeconds)}</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="lesson-card-body">
        <div>
          <h2 className="lesson-card-title">{title}</h2>
          {chapterTitle && (
            <p className="lesson-card-subtitle" style={{ marginTop: 'var(--spacing-1)' }}>
              Chapter: {chapterTitle}
            </p>
          )}
        </div>

        {/* Metrics Box */}
        <div className="lesson-card-metrics">
          {/* Progress */}
          <div>
            <div className="lesson-card-metrics-row" style={{ marginBottom: 'var(--spacing-1)' }}>
              <span className="text-caption font-medium" style={{ color: 'var(--text-secondary)' }}>
                Progress
              </span>
              <span className="text-caption font-bold" style={{ color: 'var(--text-primary)' }}>
                {progress}%
              </span>
            </div>
            <ProgressBar
              value={progress}
              variant={progress >= 100 ? 'success' : 'primary'}
              size="sm"
            />
          </div>

          {/* Mastery Score */}
          <div className="lesson-card-metrics-row" style={{ paddingTop: 'var(--spacing-1)' }}>
            <span className="text-caption font-medium" style={{ color: 'var(--text-secondary)' }}>
              Concept Mastery
            </span>
            <span className="text-caption font-bold" style={{ color: getMasteryColor() }}>
              {mastery > 0 ? `${mastery}%` : 'Not assessed'}
            </span>
          </div>
        </div>

        {/* Meta Info (Concepts count, Last activity) */}
        <div className="lesson-card-meta-list">
          <span>{conceptCount} concepts</span>
          <span>Active {lastActivity}</span>
        </div>

        {/* Action Button */}
        <div className="lesson-card-actions">
          <Link href={`/lessons/${lessonId}`} style={{ display: 'block', textDecoration: 'none' }}>
            <Button
              variant={progress > 0 ? 'primary' : 'outline'}
              size="md"
              fullWidth
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{progress > 0 ? 'Continue Lesson' : 'Start Lesson'}</span>
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

export const LessonCard = React.memo(LessonCardComponent);
export default LessonCard;
