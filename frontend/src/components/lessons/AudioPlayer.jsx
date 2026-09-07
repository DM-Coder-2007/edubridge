/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Badge, Spinner } from '../ui';
import { useOfflineAudio } from '../../hooks/useOfflineAudio';
import { useAccessibility } from '../../context/AccessibilityContext';

// Mandated candidate playback speeds
const CANDIDATE_SPEEDS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export function AudioPlayer({
  audioUrl,
  waveformUrl,
  durationSeconds = 0,
  lessonTitle = 'Lesson Narration',
  lessonId,
  metadata = {},
  onProgressUpdate,
  onSynthesizeAudio,
  isSynthesizing = false
}) {
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const waveformRef = useRef(null);

  const { audioPlaybackSpeed } = useAccessibility();

  // Offline audio integration (Student-controlled explicit caching via Service Worker & Cache API)
  const {
    isCached,
    isCaching,
    isRemoving,
    cacheError,
    offlineAudioUrl,
    effectiveAudioUrl,
    audioSourceType,
    isOnline,
    downloadForOffline,
    removeFromOffline
  } = useOfflineAudio(lessonId, audioUrl);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(audioPlaybackSpeed || 1.0);

  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1.0);
  const [audioError, setAudioError] = useState(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Detect supported playback rates by browser/player behavior
  const supportedSpeeds = useMemo(() => {
    if (typeof window === 'undefined') return CANDIDATE_SPEEDS;
    try {
      const testAudio = document.createElement('audio');
      return CANDIDATE_SPEEDS.filter((speed) => {
        try {
          testAudio.playbackRate = speed;
          return testAudio.playbackRate === speed;
        } catch {
          return false;
        }
      });
    } catch {
      return CANDIDATE_SPEEDS;
    }
  }, []);

  // Initialize duration from prop
  useEffect(() => {
    if (durationSeconds && !duration) {
      setDuration(durationSeconds);
    }
  }, [durationSeconds, duration]);

  // Synchronize playback rate when accessibility preference changes
  useEffect(() => {
    if (audioPlaybackSpeed && supportedSpeeds.includes(audioPlaybackSpeed)) {
      setPlaybackRate(audioPlaybackSpeed);
      if (audioRef.current) {
        audioRef.current.playbackRate = audioPlaybackSpeed;
      }
    }
  }, [audioPlaybackSpeed, supportedSpeeds]);


  // Format seconds to mm:ss
  const formatTime = useCallback((secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !effectiveAudioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setAudioError(null);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('[AudioPlayer] Playback error:', err);
            setAudioError({
              type: 'PLAY_FAILED',
              message: 'Unable to start audio playback. Please check your browser audio permissions.'
            });
          }
          setIsPlaying(false);
        });
    }
  }, [isPlaying, effectiveAudioUrl]);

  // Seek time handler
  const seekTo = useCallback(
    (targetTime) => {
      const clamped = Math.max(0, Math.min(duration || 100, targetTime));
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [duration]
  );

  // Skip time forward or backward
  const skipTime = useCallback(
    (seconds) => {
      if (!audioRef.current) return;
      seekTo(audioRef.current.currentTime + seconds);
    },
    [seekTo]
  );

  // Waveform Click / Tap Seek (using backend-provided waveform layout)
  const handleWaveformClick = useCallback(
    (e) => {
      if (!waveformRef.current || !duration) return;
      const rect = waveformRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      seekTo(ratio * duration);
    },
    [duration, seekTo]
  );

  // Volume Change
  const handleVolumeChange = useCallback((newVolume) => {
    const clamped = Math.max(0, Math.min(1, parseFloat(newVolume)));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      if (clamped === 0) {
        audioRef.current.muted = true;
        setIsMuted(true);
      } else if (audioRef.current.muted) {
        audioRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  // Mute Toggle
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
      const restoredVol = previousVolume > 0 ? previousVolume : 0.5;
      audioRef.current.volume = restoredVol;
      setVolume(restoredVol);
    } else {
      setPreviousVolume(volume);
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, previousVolume, volume]);

  // Speed Change
  const handleSpeedChange = useCallback((speed) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keystrokes if student is typing in an input or textarea
      const target = e.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.classList.contains('quiz-textarea')
      ) {
        return;
      }

      // Only respond if player container has focus or contains focus
      if (
        containerRef.current &&
        (containerRef.current.contains(document.activeElement) ||
          document.activeElement === document.body)
      ) {
        switch (e.key) {
          case ' ':
          case 'k':
          case 'K':
            e.preventDefault();
            togglePlay();
            break;
          case 'ArrowLeft':
          case 'j':
          case 'J':
            e.preventDefault();
            skipTime(e.shiftKey ? -10 : -5);
            break;
          case 'ArrowRight':
          case 'l':
          case 'L':
            e.preventDefault();
            skipTime(e.shiftKey ? 10 : 5);
            break;
          case 'ArrowUp':
            e.preventDefault();
            handleVolumeChange(Math.min(1, volume + 0.05));
            break;
          case 'ArrowDown':
            e.preventDefault();
            handleVolumeChange(Math.max(0, volume - 0.05));
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            toggleMute();
            break;
          case '[': {
            e.preventDefault();
            const currentIdx = supportedSpeeds.indexOf(playbackRate);
            if (currentIdx > 0) {
              handleSpeedChange(supportedSpeeds[currentIdx - 1]);
            }
            break;
          }
          case ']': {
            e.preventDefault();
            const currentIdx = supportedSpeeds.indexOf(playbackRate);
            if (currentIdx < supportedSpeeds.length - 1) {
              handleSpeedChange(supportedSpeeds[currentIdx + 1]);
            }
            break;
          }
          case 'Home':
            e.preventDefault();
            seekTo(0);
            break;
          case 'End':
            e.preventDefault();
            if (duration) seekTo(duration);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    togglePlay,
    skipTime,
    handleVolumeChange,
    toggleMute,
    handleSpeedChange,
    seekTo,
    volume,
    playbackRate,
    supportedSpeeds,
    duration
  ]);

  // Audio element native error handler
  const handleNativeAudioError = useCallback(() => {
    if (!audioRef.current) return;
    const mediaError = audioRef.current.error;
    let errorMessage = 'An error occurred during audio playback.';
    let errorType = 'GENERIC';

    if (mediaError) {
      switch (mediaError.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = 'Audio playback was aborted.';
          errorType = 'ABORTED';
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage =
            'Network failure while streaming Cloudinary audio. Please check your internet connection or use offline audio.';
          errorType = 'NETWORK_ERROR';
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage = 'Audio stream decoding error. The audio narration file may be corrupted.';
          errorType = 'DECODE_ERROR';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage =
            'Cloudinary audio format or stream URL is not supported by your browser.';
          errorType = 'FORMAT_UNSUPPORTED';
          break;
        default:
          break;
      }
    }

    console.error('[AudioPlayer] Native audio error:', errorType, errorMessage);
    setAudioError({ type: errorType, message: errorMessage });
    setIsPlaying(false);
    setIsLoadingAudio(false);
  }, []);

  // Time update callback for progress synchronization
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    setCurrentTime(current);

    const dur = audioRef.current.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      if (dur !== duration) setDuration(dur);

      if (onProgressUpdate) {
        const pct = Math.min(100, Math.round((current / dur) * 100));
        onProgressUpdate({
          completionPercentage: pct,
          lastAudioPositionSeconds: Math.round(current),
          status: pct >= 95 ? 'COMPLETED' : 'IN_PROGRESS'
        });
      }
    }
  };

  // Progress percentage for visual overlays
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Case 1: Audio is unavailable or not yet generated
  if (!effectiveAudioUrl && !audioError) {
    return (
      <div className="custom-audio-player" ref={containerRef} role="region" aria-label="Audio Narration Player">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--color-primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-body">Piper Neural TTS Narration</div>
              <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
                Audio narration has not yet been generated for this lesson.
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={onSynthesizeAudio}
            disabled={isSynthesizing}
          >
            {isSynthesizing ? (
              <>
                <Spinner size="sm" />
                <span>Synthesizing Voice...</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                </svg>
                <span>Synthesize Audio Narration</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Case 2: Error state fallback
  if (audioError) {
    return (
      <div className="audio-error-fallback" role="alert">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="audio-error-fallback-content">
          <strong style={{ fontSize: '1rem' }}>Audio Playback Unavailable</strong>
          <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-danger-800)' }}>
            {audioError.message}
          </span>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAudioError(null);
                if (audioRef.current) {
                  audioRef.current.load();
                }
              }}
            >
              Retry Loading Audio
            </Button>
            {onSynthesizeAudio && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSynthesizeAudio}
                disabled={isSynthesizing}
              >
                {isSynthesizing ? 'Synthesizing...' : 'Regenerate Narration'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Fully Featured Accessible Cloudinary Audio Player
  return (
    <section
      ref={containerRef}
      className="custom-audio-player"
      aria-label={`Accessible Cloudinary Audio Player: ${lessonTitle}`}
      tabIndex={0}
      role="region"
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={effectiveAudioUrl}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current?.duration) {
            setDuration(audioRef.current.duration);
          }
          setIsLoadingAudio(false);
        }}
        onWaiting={() => setIsLoadingAudio(true)}
        onCanPlay={() => setIsLoadingAudio(false)}
        onPlaying={() => {
          setIsLoadingAudio(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onProgressUpdate && duration) {
            onProgressUpdate({
              completionPercentage: 100,
              lastAudioPositionSeconds: Math.round(duration),
              status: 'COMPLETED'
            });
          }
        }}
        onError={handleNativeAudioError}
      />

      {/* Top Meta Bar & Offline Actions */}
      <div className="audio-player-top">
        <div className="audio-player-meta">
          <Badge variant="accent">Piper Neural Voice</Badge>
          <span className="text-small font-medium" style={{ color: 'var(--text-primary)' }}>
            {lessonTitle}
          </span>
          {audioSourceType === 'OFFLINE_CACHE' ? (
            <Badge variant="success">Offline Audio</Badge>
          ) : (
            <Badge variant="neutral">Online Audio</Badge>
          )}
          {!isOnline && (
            <Badge variant="warning">Device Offline</Badge>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          {/* Explicit User Intent Offline Caching Button & Status */}
          {isCached ? (
            <>
              {/* Status Indicator */}
              <span className="audio-offline-status" aria-label="Audio status: Available offline">
                <Badge variant="success">Available offline</Badge>
              </span>

              {/* Remove Action Button */}
              <button
                type="button"
                className="audio-offline-btn audio-offline-btn--remove"
                onClick={removeFromOffline}
                disabled={isRemoving}
                title="Remove offline copy from local browser cache"
                aria-label="Remove offline copy"
              >
                {isRemoving ? (
                  <>
                    <Spinner size="sm" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Remove offline copy</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="audio-offline-btn"
              onClick={downloadForOffline}
              disabled={isCaching}
              title="Download Cloudinary audio for offline listening"
              aria-label="Download for offline"
            >
              {isCaching ? (
                <>
                  <Spinner size="sm" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download for offline</span>
                </>
              )}
            </button>
          )}

          {/* Keyboard Shortcuts Info Toggle */}
          <button
            type="button"
            className="audio-offline-btn"
            onClick={() => setShowKeyboardHelp((prev) => !prev)}
            aria-label="Toggle keyboard shortcuts guide"
            title="Keyboard shortcuts guide"
          >
            <span aria-hidden="true">⌨️</span>
            <span>Shortcuts</span>
          </button>
        </div>
      </div>

      {cacheError && (
        <div
          role="alert"
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-danger-50)',
            border: '1px solid var(--color-danger-100)',
            color: 'var(--color-danger-900)',
            fontSize: 'var(--font-size-caption)'
          }}
        >
          <strong>Offline Storage Notice:</strong> {cacheError}
        </div>
      )}

      {/* Waveform Section (Backend Cloudinary-Delivered Waveform) */}
      <div
        ref={waveformRef}
        className="audio-waveform-container"
        onClick={handleWaveformClick}
        role="slider"
        tabIndex={0}
        aria-label="Waveform seeker. Click or press arrow keys to navigate narration."
        aria-valuemin="0"
        aria-valuemax={duration || 100}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      >
        {waveformUrl ? (
          <>
            {/* Backend Waveform Background */}
            <img
              src={waveformUrl}
              alt="Cloudinary audio waveform track"
              className="audio-waveform-img"
              loading="lazy"
            />
            {/* Waveform Progress Fill Overlay */}
            <div
              className="audio-waveform-overlay"
              style={{ width: `${progressPercent}%` }}
            >
              <img
                src={waveformUrl}
                alt=""
                className="audio-waveform-overlay-img"
                style={{ width: waveformRef.current ? `${waveformRef.current.clientWidth}px` : '100%' }}
                aria-hidden="true"
              />
            </div>
          </>
        ) : (
          /* Fallback visualizer when no waveform image provided */
          <div className="audio-waveform-fallback" aria-hidden="true">
            {[14, 22, 28, 16, 10, 20, 26, 12, 18, 30, 16, 22, 26, 18, 12, 24, 28, 14, 20, 10].map(
              (h, idx) => (
                <div
                  key={idx}
                  className={`audio-fallback-bar ${isPlaying ? 'audio-fallback-bar--active' : ''}`}
                  style={{
                    height: isPlaying ? undefined : `${h * 0.5}px`,
                    animationDelay: `${idx * 0.06}s`,
                    backgroundColor:
                      (idx / 20) * 100 <= progressPercent
                        ? 'var(--color-primary-600)'
                        : 'var(--color-primary-300)'
                  }}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Timeline Scrubber (Touch-friendly 44px+ hit area) */}
      <div className="audio-timeline-box">
        <span className="audio-time-label" aria-label="Current playback position">
          {formatTime(currentTime)}
        </span>

        <div className="audio-scrubber-track">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.25"
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="audio-scrubber-input"
            aria-label="Seek audio timeline scrubber"
            aria-valuemin="0"
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </div>

        <span className="audio-time-label" aria-label="Total narration duration">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls Row: Play/Pause, Seek, Volume, Playback Speed */}
      <div className="audio-controls-row">
        {/* Main Playback & Seek Controls */}
        <div className="audio-main-controls">
          {/* Skip Backward 10s */}
          <button
            type="button"
            className="audio-skip-btn"
            onClick={() => skipTime(-10)}
            title="Rewind 10 seconds (Shortcut: Shift + Left Arrow)"
            aria-label="Rewind 10 seconds"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>

          {/* Large Play/Pause Toggle */}
          <button
            type="button"
            className="audio-big-play-btn"
            onClick={togglePlay}
            disabled={isLoadingAudio}
            title={isPlaying ? 'Pause narration (Shortcut: Space)' : 'Play narration (Shortcut: Space)'}
            aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
          >
            {isLoadingAudio ? (
              <Spinner size="sm" />
            ) : isPlaying ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginLeft: '3px' }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Skip Forward 10s */}
          <button
            type="button"
            className="audio-skip-btn"
            onClick={() => skipTime(10)}
            title="Fast forward 10 seconds (Shortcut: Shift + Right Arrow)"
            aria-label="Fast forward 10 seconds"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            </svg>
          </button>
        </div>

        {/* Secondary Controls: Volume & Speeds */}
        <div className="audio-secondary-controls">
          {/* Volume Control */}
          <div className="audio-volume-group">
            <button
              type="button"
              className="audio-skip-btn"
              onClick={toggleMute}
              title={isMuted ? 'Unmute audio (Shortcut: M)' : 'Mute audio (Shortcut: M)'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(e.target.value)}
              className="audio-volume-slider"
              aria-label="Audio playback volume level"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
            />
          </div>

          {/* Mandated Speeds: 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x */}
          <div className="audio-speed-pills" role="group" aria-label="Playback speed selector">
            {supportedSpeeds.map((rate) => {
              const label = rate === 1.0 ? '1x' : `${rate}x`;
              const isSelected = playbackRate === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  className={`audio-speed-pill ${isSelected ? 'audio-speed-pill--active' : ''}`}
                  onClick={() => handleSpeedChange(rate)}
                  aria-pressed={isSelected}
                  aria-label={`Set speed to ${label}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Helper Drawer */}
      {showKeyboardHelp && (
        <div className="audio-keyboard-hint" role="note" aria-label="Keyboard Shortcuts">
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
            <span><kbd className="audio-kbd-key">Space</kbd> Play/Pause</span>
            <span><kbd className="audio-kbd-key">←</kbd>/<kbd className="audio-kbd-key">→</kbd> Seek ±5s</span>
            <span><kbd className="audio-kbd-key">Shift</kbd>+<kbd className="audio-kbd-key">←</kbd>/<kbd className="audio-kbd-key">→</kbd> ±10s</span>
            <span><kbd className="audio-kbd-key">↑</kbd>/<kbd className="audio-kbd-key">↓</kbd> Volume</span>
            <span><kbd className="audio-kbd-key">M</kbd> Mute</span>
            <span><kbd className="audio-kbd-key">[</kbd>/<kbd className="audio-kbd-key">]</kbd> Speed</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{ fontSize: '0.75rem', padding: '1px 6px', minHeight: '22px' }}
            onClick={() => setShowKeyboardHelp(false)}
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
