'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useReadAloud } from '../../hooks/useReadAloud';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Badge } from '../ui';

/**
 * Text highlighter component that renders text with a highlighted segment
 * based on the character index reported by SpeechSynthesis boundary events.
 */
function HighlightedReadingText({ text, charIndex, charLength }) {
  if (!text) return null;

  // If charIndex is 0 and not speaking yet, render plain text
  if (charIndex === undefined || charIndex < 0 || charIndex >= text.length) {
    return <span>{text}</span>;
  }

  // Find start and end of the word or phrase around charIndex
  const beforeText = text.substring(0, charIndex);

  // If charLength is provided and valid, use it; otherwise find the word boundary
  let highlightEnd = charIndex + (charLength > 0 ? charLength : 1);
  if (charLength <= 0) {
    // Search for next whitespace or punctuation
    const nextSpace = text.indexOf(' ', charIndex);
    highlightEnd = nextSpace !== -1 ? nextSpace : text.length;
  }

  const highlightedWord = text.substring(charIndex, highlightEnd);
  const afterText = text.substring(highlightEnd);

  return (
    <div className="read-aloud-text-preview" role="region" aria-label="Spoken text preview">
      <span>{beforeText}</span>
      <mark className="read-aloud-mark" aria-current="location">
        {highlightedWord}
      </mark>
      <span>{afterText}</span>
    </div>
  );
}

export function ReadAloud({
  lesson,
  currentSection = 'overview',
  onSectionSelect
}) {
  const { readAloudRate } = useAccessibility();
  const {
    isSupported,
    isPlaying,
    isPaused,
    charIndex,
    charLength,
    rate,
    setRate,
    start,
    pause,
    resume,
    stop,
    error
  } = useReadAloud(readAloudRate);


  const [readingMode, setReadingMode] = useState('section'); // 'section' | 'entire'
  const [activeSectionId, setActiveSectionId] = useState(currentSection || 'overview');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  // Keep activeSectionId in sync with currentSection prop
  useEffect(() => {
    if (currentSection && !isPlaying) {
      setActiveSectionId(currentSection);
    }
  }, [currentSection, isPlaying]);

  // Extract structured text sections from lesson
  const sections = useMemo(() => {
    if (!lesson) return [];

    const list = [];

    if (lesson.summary) {
      list.push({
        id: 'overview',
        title: 'Executive Summary',
        text: lesson.summary
      });
    }

    const explanation = lesson.simplifiedText || lesson.screenReaderTranscript;
    if (explanation) {
      list.push({
        id: 'explanation',
        title: 'Core Explanation',
        text: explanation
      });
    }

    if (Array.isArray(lesson.sensoryAnalogies) && lesson.sensoryAnalogies.length > 0) {
      const analogiesText = lesson.sensoryAnalogies
        .map((a) => (typeof a === 'string' ? a : a.analogy || a.explanation))
        .filter(Boolean)
        .join('. ');

      if (analogiesText) {
        list.push({
          id: 'analogies',
          title: 'Sensory & Tactile Analogies',
          text: analogiesText
        });
      }
    }

    if (Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length > 0) {
      const takeawaysText = lesson.keyTakeaways
        .map((t, idx) => `Takeaway ${idx + 1}: ${typeof t === 'string' ? t : t.name || t.explanation}`)
        .join('. ');

      if (takeawaysText) {
        list.push({
          id: 'concepts',
          title: 'Key Takeaways & Concepts',
          text: takeawaysText
        });
      }
    }

    return list;
  }, [lesson]);

  // Entire lesson text concatenated
  const entireLessonText = useMemo(() => {
    if (!lesson) return '';
    const parts = [
      lesson.title ? `Lesson Title: ${lesson.title}.` : '',
      ...sections.map((s) => `${s.title}. ${s.text}`)
    ];
    return parts.filter(Boolean).join(' ');
  }, [lesson, sections]);

  // Current active section text
  const currentSectionData = useMemo(() => {
    return sections.find((s) => s.id === activeSectionId) || sections[0] || null;
  }, [sections, activeSectionId]);

  // Active text to read
  const activeText = readingMode === 'entire' ? entireLessonText : currentSectionData?.text || '';

  // Announce status changes to screen reader
  const updateStatus = useCallback((msg) => {
    setStatusAnnouncement(msg);
  }, []);

  // Play / Start Handler
  const handleStart = () => {
    if (!activeText) return;

    if (isPaused) {
      resume();
      updateStatus('Read-aloud resumed.');
    } else {
      const label = readingMode === 'entire' ? 'Entire Lesson' : currentSectionData?.title || 'Current Section';
      start(activeText, { sectionId: activeSectionId });
      updateStatus(`Reading aloud: ${label}`);
    }
  };

  // Pause Handler
  const handlePause = () => {
    pause();
    updateStatus('Read-aloud paused.');
  };

  // Stop Handler
  const handleStop = () => {
    stop();
    updateStatus('Read-aloud stopped.');
  };

  // Section Change Handler
  const handleSectionClick = (secId) => {
    setActiveSectionId(secId);
    if (onSectionSelect) {
      onSectionSelect(secId);
    }
    if (isPlaying) {
      const targetSec = sections.find((s) => s.id === secId);
      if (targetSec) {
        start(targetSec.text, { sectionId: secId });
        updateStatus(`Reading aloud: ${targetSec.title}`);
      }
    }
  };

  // Graceful failure fallback: Web Speech API unsupported in browser
  if (!isSupported) {
    return (
      <div className="read-aloud-unavailable" role="status" aria-live="polite">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Read-aloud isn&apos;t supported in this browser.</span>
      </div>
    );
  }

  return (
    <section
      className={`read-aloud-panel ${isPlaying ? 'read-aloud-panel--active' : ''}`}
      aria-label="Browser Read Aloud Assistant"
    >
      {/* Screen Reader Live Region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      {/* Top Header: Title & Mode Toggle */}
      <div className="read-aloud-header">
        <div className="read-aloud-title-group">
          <div className={`read-aloud-icon ${isPlaying ? 'read-aloud-icon--active' : ''}`} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-small" style={{ color: 'var(--text-primary)' }}>
              Web Speech Read-Aloud
            </div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              Accessible in-browser text-to-speech
            </div>
          </div>

          {isPlaying && (
            <Badge variant="primary">
              {isPaused ? 'Paused' : 'Reading...'}
            </Badge>
          )}
        </div>

        {/* Mode Selector: Current Section vs Entire Lesson */}
        <div className="read-aloud-mode-tabs" role="tablist" aria-label="Reading scope">
          <button
            type="button"
            role="tab"
            aria-selected={readingMode === 'section'}
            className={`read-aloud-mode-btn ${readingMode === 'section' ? 'read-aloud-mode-btn--active' : ''}`}
            onClick={() => {
              setReadingMode('section');
              if (isPlaying) stop();
            }}
          >
            Read Current Section
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={readingMode === 'entire'}
            className={`read-aloud-mode-btn ${readingMode === 'entire' ? 'read-aloud-mode-btn--active' : ''}`}
            onClick={() => {
              setReadingMode('entire');
              if (isPlaying) stop();
            }}
          >
            Read Entire Lesson
          </button>
        </div>
      </div>

      {/* Section Quick Pills (when reading mode is 'section') */}
      {readingMode === 'section' && sections.length > 1 && (
        <div
          style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', alignItems: 'center' }}
          role="group"
          aria-label="Select section to read aloud"
        >
          <span className="text-caption font-medium" style={{ color: 'var(--text-secondary)' }}>
            Section:
          </span>
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              className={`btn btn-sm ${activeSectionId === sec.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '2px 8px', minHeight: '26px' }}
              onClick={() => handleSectionClick(sec.id)}
              aria-pressed={activeSectionId === sec.id}
            >
              {sec.title}
            </button>
          ))}
        </div>
      )}

      {/* Spoken Text Preview with Live Word/Sentence Highlighting */}
      {isPlaying && activeText && (
        <HighlightedReadingText
          text={activeText}
          charIndex={charIndex}
          charLength={charLength}
        />
      )}

      {/* Controls Bar: Start, Pause, Resume, Stop, Speed */}
      <div className="read-aloud-controls">
        <div className="read-aloud-btn-group">
          {!isPlaying || isPaused ? (
            <button
              type="button"
              className="read-aloud-action-btn read-aloud-action-btn--primary"
              onClick={handleStart}
              aria-label={isPaused ? 'Resume read aloud' : 'Start read aloud'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{isPaused ? 'Resume' : 'Start Reading'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="read-aloud-action-btn"
              onClick={handlePause}
              aria-label="Pause read aloud"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span>Pause</span>
            </button>
          )}

          {isPlaying && (
            <button
              type="button"
              className="read-aloud-action-btn read-aloud-action-btn--danger"
              onClick={handleStop}
              aria-label="Stop read aloud"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Speed Adjustment: 0.75x, 1x, 1.25x, 1.5x */}
        <div className="read-aloud-rate-group" role="group" aria-label="Speech rate selector">
          <span className="text-caption font-medium" style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>
            Speed:
          </span>
          {[0.75, 1.0, 1.25, 1.5].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`read-aloud-rate-btn ${rate === speed ? 'read-aloud-rate-btn--active' : ''}`}
              onClick={() => setRate(speed)}
              aria-pressed={rate === speed}
              aria-label={`Set speech rate to ${speed}x`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-danger-700)' }}>
          {error}
        </div>
      )}
    </section>
  );
}

export default ReadAloud;
