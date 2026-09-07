'use client';

import React, { useState, useCallback } from 'react';
import { PageContainer } from '../../components/shell';
import { ProtectedRoute } from '../../components/auth';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, useToast } from '../../components/ui';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useAuth } from '../../context/AuthContext';

const FONT_SIZE_OPTIONS = [
  {
    id: 'normal',
    name: 'Default',
    scale: '100% (16px)',
    previewClass: 'font-size-card-preview--normal',
    description: 'Standard platform typography scaling'
  },
  {
    id: 'large',
    name: 'Large',
    scale: '+12.5% (18px)',
    previewClass: 'font-size-card-preview--large',
    description: 'Enlarged body text and headings for improved comfort'
  },
  {
    id: 'xlarge',
    name: 'Extra Large',
    scale: '+25% (20px)',
    previewClass: 'font-size-card-preview--xlarge',
    description: 'Maximum contrast typography for low-vision legibility'
  }
];

const READ_ALOUD_RATES = [
  { value: 0.75, label: '0.75x (Gentle)' },
  { value: 1.0, label: '1.0x (Normal)' },
  { value: 1.25, label: '1.25x (Brisk)' },
  { value: 1.5, label: '1.5x (Fast)' }
];

const AUDIO_SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2.0, label: '2.0x' }
];

export default function SettingsPage() {
  const {
    isHighContrast,
    fontSize,
    reducedMotion,
    readAloudRate,
    audioPlaybackSpeed,
    autoReadAloud,
    systemReducedMotion,
    isSaving,
    setHighContrast,
    toggleHighContrast,
    setFontSize,
    setReducedMotion,
    toggleReducedMotion,
    setReadAloudRate,
    setAudioPlaybackSpeed,
    setAutoReadAloud,
    savePreferences,
    resetToDefaults,
    announce
  } = useAccessibility();

  const { user } = useAuth();
  const toast = useToast();

  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Test Speech Synthesis using browser Web Speech API
  const handleTestVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Web Speech API is not supported in this browser');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const text = `This is a test of your EduBridge read aloud voice at ${readAloudRate} times speed.`;
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = readAloudRate;

      setIsTestingVoice(true);
      utterance.onend = () => setIsTestingVoice(false);
      utterance.onerror = () => setIsTestingVoice(false);

      window.speechSynthesis.speak(utterance);
      announce(`Speaking sample sentence at ${readAloudRate}x speed`);
    } catch (err) {
      console.warn('Speech test error:', err);
      setIsTestingVoice(false);
    }
  }, [readAloudRate, toast, announce]);

  // Handle explicit save button
  const handleExplicitSave = async () => {
    try {
      await savePreferences({
        highContrast: isHighContrast,
        fontSize,
        reducedMotion,
        readAloudRate,
        audioPlaybackSpeed,
        autoReadAloud
      });
      setSaveSuccess(true);
      toast.success('Accessibility preferences saved successfully');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      toast.error('Failed to persist preferences: ' + (err.message || 'Network error'));
    }
  };

  // Handle reset to defaults
  const handleReset = async () => {
    try {
      await resetToDefaults();
      toast.info('Preferences reset to platform defaults');
    } catch (err) {
      toast.error('Failed to reset: ' + err.message);
    }
  };

  return (
    <ProtectedRoute>
      <PageContainer>
        <div className="settings-container">
          {/* Header */}
          <header className="settings-header">
            <div className="settings-header-text">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="settings-header-title">Accessibility Center</h1>
                <Badge variant="accent">WCAG 2.1 AAA</Badge>
              </div>
              <p className="settings-header-subtitle">
                Customize your visual display, typography scaling, motion, browser read-aloud speed, and audio narration.
                Preferences are synchronized with your profile and preserved across devices.
              </p>
            </div>

            <div className="settings-header-actions">
              <Button
                variant="outline"
                size="md"
                onClick={handleReset}
                disabled={isSaving}
                aria-label="Reset all preferences to default values"
              >
                Reset to Defaults
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExplicitSave}
                loading={isSaving}
                aria-label="Save all current accessibility preferences"
              >
                {saveSuccess ? '✓ Saved' : 'Save Preferences'}
              </Button>
            </div>
          </header>

          {/* Main Settings Sections */}
          <div className="settings-grid">
            {/* 1. Typography & Text Scaling */}
            <section className="settings-section--full" aria-labelledby="font-size-heading">
              <Card className="settings-card">
                <CardHeader className="settings-card-header">
                  <div className="settings-card-title-group">
                    <h2 id="font-size-heading" className="settings-card-title">
                      <svg
                        className="settings-card-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h8m-8 6h16"
                        />
                      </svg>
                      Typography & Text Scaling
                    </h2>
                    <p className="settings-card-description">
                      Choose your preferred text size. The entire application responds proportionally without horizontal layout breakage or simple browser zoom distortion.
                    </p>
                  </div>
                  <Badge variant="primary">
                    Current: {fontSize.toUpperCase()}
                  </Badge>
                </CardHeader>

                <CardBody>
                  <div
                    className="font-size-grid"
                    role="radiogroup"
                    aria-labelledby="font-size-heading"
                  >
                    {FONT_SIZE_OPTIONS.map((opt) => {
                      const isSelected = fontSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          className={`font-size-card ${isSelected ? 'font-size-card--selected' : ''}`}
                          onClick={() => setFontSize(opt.id)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setFontSize(opt.id);
                            }
                          }}
                        >
                          <div className="font-size-card-header">
                            <span className="font-size-card-name">{opt.name}</span>
                            <span className="font-size-card-scale">{opt.scale}</span>
                          </div>

                          <div className={`font-size-card-preview ${opt.previewClass}`}>
                            The cell membrane regulates molecular transport and cell integrity.
                          </div>

                          {isSelected && (
                            <span className="font-size-card-badge" aria-hidden="true">
                              ✓ Active Selection
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* 2. Visual Contrast */}
            <section aria-labelledby="contrast-heading">
              <Card className="settings-card">
                <CardHeader className="settings-card-header">
                  <div className="settings-card-title-group">
                    <h2 id="contrast-heading" className="settings-card-title">
                      <svg
                        className="settings-card-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      High Contrast Theme
                    </h2>
                    <p className="settings-card-description">
                      High luminance theme with deep black surfaces and distinct yellow outlines.
                    </p>
                  </div>
                </CardHeader>

                <CardBody>
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <span className="settings-toggle-label">Ultra High Contrast Mode</span>
                      <span className="settings-toggle-subtext">
                        Enforces 7:1+ contrast ratios with crisp yellow borders and underlined links. Does not rely solely on color.
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isHighContrast}
                      aria-label="Ultra High Contrast Mode"
                      className={`settings-switch ${isHighContrast ? 'settings-switch--active' : ''}`}
                      onClick={toggleHighContrast}
                    >
                      <span className="settings-switch-handle">
                        {isHighContrast ? '✓' : ''}
                      </span>
                    </button>
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* 3. Reduced Motion */}
            <section aria-labelledby="motion-heading">
              <Card className="settings-card">
                <CardHeader className="settings-card-header">
                  <div className="settings-card-title-group">
                    <h2 id="motion-heading" className="settings-card-title">
                      <svg
                        className="settings-card-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Reduced Motion
                    </h2>
                    <p className="settings-card-description">
                      Control motion effects and transitions to prevent vestibular discomfort.
                    </p>
                  </div>
                  {systemReducedMotion && (
                    <Badge variant="info">OS Setting Active</Badge>
                  )}
                </CardHeader>

                <CardBody>
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <span className="settings-toggle-label">Disable Motion & Transitions</span>
                      <span className="settings-toggle-subtext">
                        Removes UI animations, slide transitions, and pulsing loaders. Respects system prefers-reduced-motion.
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={reducedMotion}
                      aria-label="Disable Motion and Transitions"
                      className={`settings-switch ${reducedMotion ? 'settings-switch--active' : ''}`}
                      onClick={toggleReducedMotion}
                    >
                      <span className="settings-switch-handle">
                        {reducedMotion ? '✓' : ''}
                      </span>
                    </button>
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* 4. Browser Read-Aloud (Web Speech API) */}
            <section aria-labelledby="read-aloud-heading">
              <Card className="settings-card">
                <CardHeader className="settings-card-header">
                  <div className="settings-card-title-group">
                    <h2 id="read-aloud-heading" className="settings-card-title">
                      <svg
                        className="settings-card-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                        />
                      </svg>
                      Browser Read-Aloud
                    </h2>
                    <p className="settings-card-description">
                      Configure the native browser speech synthesis engine used for reading lesson text.
                    </p>
                  </div>
                </CardHeader>

                <CardBody>
                  <div className="stack">
                    <div>
                      <label className="form-label" style={{ marginBottom: 'var(--spacing-2)' }}>
                        Speaking Speed
                      </label>
                      <div className="speed-selector-group" role="radiogroup" aria-label="Speaking speed">
                        {READ_ALOUD_RATES.map((rate) => {
                          const isActive = readAloudRate === rate.value;
                          return (
                            <button
                              key={rate.value}
                              type="button"
                              role="radio"
                              aria-checked={isActive}
                              className={`speed-option-btn ${isActive ? 'speed-option-btn--active' : ''}`}
                              onClick={() => setReadAloudRate(rate.value)}
                            >
                              {rate.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="settings-toggle-row" style={{ marginTop: 'var(--spacing-2)' }}>
                      <div className="settings-toggle-info">
                        <span className="settings-toggle-label">Auto Read-Aloud on Navigation</span>
                        <span className="settings-toggle-subtext">
                          Automatically start reading section text aloud when navigating between lesson sections.
                        </span>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoReadAloud}
                        aria-label="Auto Read Aloud on Navigation"
                        className={`settings-switch ${autoReadAloud ? 'settings-switch--active' : ''}`}
                        onClick={() => setAutoReadAloud(!autoReadAloud)}
                      >
                        <span className="settings-switch-handle">
                          {autoReadAloud ? '✓' : ''}
                        </span>
                      </button>
                    </div>

                    <div style={{ marginTop: 'var(--spacing-3)' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleTestVoice}
                        disabled={isTestingVoice}
                        aria-label="Test current read aloud voice and speed"
                      >
                        {isTestingVoice ? 'Speaking Sample...' : '🔊 Test Read-Aloud Voice'}
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* 5. Audio Player Speed */}
            <section aria-labelledby="audio-speed-heading">
              <Card className="settings-card">
                <CardHeader className="settings-card-header">
                  <div className="settings-card-title-group">
                    <h2 id="audio-speed-heading" className="settings-card-title">
                      <svg
                        className="settings-card-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                      Audio Narration Speed
                    </h2>
                    <p className="settings-card-description">
                      Default playback rate when listening to Cloudinary-delivered lesson narration and teacher recordings.
                    </p>
                  </div>
                  <Badge variant="accent">{audioPlaybackSpeed}x Default</Badge>
                </CardHeader>

                <CardBody>
                  <div className="stack">
                    <label className="form-label" style={{ marginBottom: 'var(--spacing-2)' }}>
                      Default Playback Speed
                    </label>
                    <div className="speed-selector-group" role="radiogroup" aria-label="Audio player playback speed">
                      {AUDIO_SPEED_OPTIONS.map((opt) => {
                        const isActive = audioPlaybackSpeed === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`speed-option-btn ${isActive ? 'speed-option-btn--active' : ''}`}
                            onClick={() => setAudioPlaybackSpeed(opt.value)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-caption" style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-2)' }}>
                      You can also adjust the speed dynamically within the audio player during playback.
                    </p>
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* 6. Live Adaptation Preview */}
            <section className="settings-section--full" aria-labelledby="preview-heading">
              <div className="preview-container">
                <div className="preview-header">
                  <div>
                    <h2 id="preview-heading" className="text-h3">
                      Live Experience Preview
                    </h2>
                    <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                      Observe how your current contrast, text size, and interactive button styles appear together:
                    </p>
                  </div>
                  <Badge variant={isHighContrast ? 'warning' : 'primary'}>
                    {isHighContrast ? 'Ultra High Contrast' : 'Standard Contrast'} • {fontSize.toUpperCase()}
                  </Badge>
                </div>

                <div className="preview-sample-content">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Biology • Chapter 4</Badge>
                    <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                      Estimated read time: 3 mins
                    </span>
                  </div>

                  <h3 className="preview-sample-title">
                    Cellular Respiration & Energy Transfer
                  </h3>

                  <p className="preview-sample-body">
                    Mitochondria are the powerhouses of eukaryotic cells. Through the citric acid cycle and oxidative phosphorylation,
                    they produce <mark className="preview-sample-highlight">ATP molecules</mark> that power cellular functions.
                  </p>

                  <div className="preview-sample-actions">
                    <Button variant="primary" size="sm">
                      Continue Lesson
                    </Button>
                    <Button variant="secondary" size="sm">
                      🔊 Listen ({audioPlaybackSpeed}x)
                    </Button>
                    <Button variant="outline" size="sm">
                      Practice Quiz
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
