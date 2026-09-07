'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useReadAloud
 *
 * Browser Web Speech API (speechSynthesis) hook for accessible lesson read-aloud.
 * Strictly client-side browser speech synthesis (NO external Google Speech Recognition API).
 * Tracks word/character boundary events for live highlighting where browser allows.
 */
export function useReadAloud(defaultRate = 1.0) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentSectionId, setCurrentSectionId] = useState(null);
  const [charIndex, setCharIndex] = useState(0);
  const [charLength, setCharLength] = useState(0);
  const [rate, setRateState] = useState(defaultRate || 1.0);
  const [pitch, setPitchState] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (defaultRate) {
      setRateState(defaultRate);
    }
  }, [defaultRate]);


  const utteranceRef = useRef(null);
  const textRef = useRef('');

  // 1. Detect Web Speech API synthesis support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      setIsSupported(true);

      const updateVoices = () => {
        try {
          const availableVoices = window.speechSynthesis.getVoices();
          setVoices(availableVoices);

          // Default to high quality English voice if available
          if (availableVoices.length > 0) {
            const preferred =
              availableVoices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft'))) ||
              availableVoices.find((v) => v.lang.startsWith('en')) ||
              availableVoices[0];
            setSelectedVoice((prev) => prev || preferred);
          }
        } catch (vErr) {
          console.warn('[useReadAloud] Voice enumeration warning:', vErr);
        }
      };

      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    } else {
      setIsSupported(false);
    }

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  /**
   * Stop Speech Synthesis completely
   */
  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn('[useReadAloud] Stop error:', err);
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCharIndex(0);
    setCharLength(0);
    utteranceRef.current = null;
  }, []);

  /**
   * Start / Speak Given Text
   * @param {string} text - The lesson or section text to read aloud
   * @param {object} options - { sectionId, customRate, customVoice }
   */
  const start = useCallback(
    (text, options = {}) => {
      if (!isSupported || !text || typeof text !== 'string' || text.trim().length === 0) {
        return;
      }

      const cleanText = text.trim();
      textRef.current = cleanText;

      // Cancel any ongoing speech first
      stop();

      try {
        const utterance = new window.SpeechSynthesisUtterance(cleanText);
        utterance.rate = options.customRate || rate;
        utterance.pitch = pitch;
        utterance.lang = selectedVoice?.lang || 'en-US';
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
          setIsPlaying(true);
          setIsPaused(false);
          setError(null);
          setCurrentText(cleanText);
          setCurrentSectionId(options.sectionId || 'all');
          setCharIndex(0);
          setCharLength(0);
        };

        utterance.onpause = () => {
          setIsPaused(true);
        };

        utterance.onresume = () => {
          setIsPaused(false);
        };

        // Boundary event: provides character index for live text highlighting
        utterance.onboundary = (event) => {
          if (event.name === 'word' || event.name === 'sentence' || typeof event.charIndex === 'number') {
            setCharIndex(event.charIndex);
            setCharLength(event.charLength || 0);
          }
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCharIndex(cleanText.length);
          utteranceRef.current = null;
        };

        utterance.onerror = (event) => {
          // Ignore canceled or interrupted events caused by manual stop
          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            console.error('[useReadAloud] Utterance error:', event.error);
            setError(`Speech synthesis error: ${event.error}`);
          }
          setIsPlaying(false);
          setIsPaused(false);
          utteranceRef.current = null;
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[useReadAloud] Start exception:', err);
        setError('Failed to initiate browser speech synthesis.');
        setIsPlaying(false);
        setIsPaused(false);
      }
    },
    [isSupported, rate, pitch, selectedVoice, stop]
  );

  /**
   * Pause Speech Synthesis
   */
  const pause = useCallback(() => {
    if (!isSupported || !isPlaying || isPaused) return;
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } catch (err) {
      console.warn('[useReadAloud] Pause warning:', err);
    }
  }, [isSupported, isPlaying, isPaused]);

  /**
   * Resume Speech Synthesis
   */
  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } catch (err) {
      console.warn('[useReadAloud] Resume warning:', err);
    }
  }, [isSupported, isPaused]);

  /**
   * Adjust Playback Rate
   */
  const setRate = useCallback(
    (newRate) => {
      const clamped = Math.max(0.5, Math.min(2.0, parseFloat(newRate || 1.0)));
      setRateState(clamped);
      // If currently playing, restart from current position with new rate
      if (isPlaying && currentText) {
        const remaining = currentText.substring(charIndex);
        start(remaining, { sectionId: currentSectionId, customRate: clamped });
      }
    },
    [isPlaying, currentText, charIndex, currentSectionId, start]
  );

  /**
   * Select Voice
   */
  const setVoice = useCallback((voice) => {
    setSelectedVoice(voice);
  }, []);

  return {
    isSupported,
    isPlaying,
    isPaused,
    currentText,
    currentSectionId,
    charIndex,
    charLength,
    rate,
    voices,
    selectedVoice,
    error,
    start,
    pause,
    resume,
    stop,
    setRate,
    setVoice
  };
}
