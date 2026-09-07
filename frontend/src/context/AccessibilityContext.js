'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

// Storage keys for safe non-sensitive client preferences
const STORAGE_KEYS = {
  CONTRAST: 'edubridge_pref_contrast',
  LEGACY_CONTRAST: 'edubridge_contrast',
  FONT_SIZE: 'edubridge_pref_fontsize',
  LEGACY_FONT_SIZE: 'edubridge_fontsize',
  REDUCED_MOTION: 'edubridge_pref_reduced_motion',
  READ_ALOUD_RATE: 'edubridge_pref_read_aloud_rate',
  AUDIO_SPEED: 'edubridge_pref_audio_speed',
  AUTO_READ_ALOUD: 'edubridge_pref_auto_read_aloud'
};

const DEFAULT_PREFERENCES = {
  isHighContrast: false,
  fontSize: 'normal', // 'normal' | 'large' | 'xlarge'
  reducedMotion: false,
  readAloudRate: 1.0, // 0.75 | 1.0 | 1.25 | 1.5
  audioPlaybackSpeed: 1.0, // 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0
  autoReadAloud: false
};

const AccessibilityContext = createContext({
  ...DEFAULT_PREFERENCES,
  systemReducedMotion: false,
  isSaving: false,
  toggleHighContrast: () => {},
  setHighContrast: () => {},
  setFontSize: () => {},
  cycleFontSize: () => {},
  setReducedMotion: () => {},
  toggleReducedMotion: () => {},
  setReadAloudRate: () => {},
  setAudioPlaybackSpeed: () => {},
  setAutoReadAloud: () => {},
  savePreferences: async () => {},
  resetToDefaults: async () => {},
  announce: () => {}
});

export function AccessibilityProvider({ children }) {
  const { user, updatePreferences: authUpdatePreferences } = useAuth();

  const [isHighContrast, setIsHighContrast] = useState(DEFAULT_PREFERENCES.isHighContrast);
  const [fontSize, setFontSizeState] = useState(DEFAULT_PREFERENCES.fontSize);
  const [reducedMotion, setReducedMotionState] = useState(DEFAULT_PREFERENCES.reducedMotion);
  const [readAloudRate, setReadAloudRateState] = useState(DEFAULT_PREFERENCES.readAloudRate);
  const [audioPlaybackSpeed, setAudioPlaybackSpeedState] = useState(DEFAULT_PREFERENCES.audioPlaybackSpeed);
  const [autoReadAloud, setAutoReadAloudState] = useState(DEFAULT_PREFERENCES.autoReadAloud);

  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const initializedRef = useRef(false);

  // Apply DOM attributes to document.documentElement
  const applyDomAttributes = useCallback((contrast, fSize, rMotion) => {
    if (typeof document === 'undefined') return;

    // High Contrast attribute
    if (contrast) {
      document.documentElement.setAttribute('data-contrast', 'high');
    } else {
      document.documentElement.removeAttribute('data-contrast');
    }

    // Font size scaling attribute
    if (fSize && fSize !== 'normal') {
      document.documentElement.setAttribute('data-font-size', fSize);
    } else {
      document.documentElement.removeAttribute('data-font-size');
    }

    // Reduced motion attribute
    if (rMotion) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }, []);

  // Announce messages via live ARIA region for screen readers
  const announce = useCallback((msg) => {
    setAnnouncement('');
    setTimeout(() => {
      setAnnouncement(msg);
    }, 60);
  }, []);

  // Detect OS prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReducedMotion(mediaQuery.matches);

    const handleChange = (e) => {
      setSystemReducedMotion(e.matches);
      // If user hasn't explicitly set a preference, follow system
      const stored = localStorage.getItem(STORAGE_KEYS.REDUCED_MOTION);
      if (stored === null && !user?.accessibilityPreferences?.reducedMotion) {
        setReducedMotionState(e.matches);
        if (e.matches) {
          document.documentElement.setAttribute('data-reduced-motion', 'true');
        } else {
          document.documentElement.removeAttribute('data-reduced-motion');
        }
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [user]);

  // Initial load: parse localStorage and reconcile with backend user profile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Read safe localStorage keys (safe fallback, no credentials)
    const storedContrast =
      localStorage.getItem(STORAGE_KEYS.CONTRAST) === 'high' ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_CONTRAST) === 'high';

    const storedFontSize =
      localStorage.getItem(STORAGE_KEYS.FONT_SIZE) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_FONT_SIZE) ||
      DEFAULT_PREFERENCES.fontSize;

    const storedMotionRaw = localStorage.getItem(STORAGE_KEYS.REDUCED_MOTION);
    const storedReducedMotion =
      storedMotionRaw !== null
        ? storedMotionRaw === 'true'
        : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const storedRateRaw = localStorage.getItem(STORAGE_KEYS.READ_ALOUD_RATE);
    const storedReadAloudRate = storedRateRaw ? parseFloat(storedRateRaw) : DEFAULT_PREFERENCES.readAloudRate;

    const storedSpeedRaw = localStorage.getItem(STORAGE_KEYS.AUDIO_SPEED);
    const storedAudioSpeed = storedSpeedRaw ? parseFloat(storedSpeedRaw) : DEFAULT_PREFERENCES.audioPlaybackSpeed;

    const storedAutoReadRaw = localStorage.getItem(STORAGE_KEYS.AUTO_READ_ALOUD);
    const storedAutoReadAloud = storedAutoReadRaw === 'true';

    // 2. Reconcile with authenticated backend user profile if present
    const backendPrefs = user?.accessibilityPreferences || {};

    const effectiveContrast = backendPrefs.highContrast !== undefined ? Boolean(backendPrefs.highContrast) : storedContrast;
    const effectiveFontSize = backendPrefs.fontSize || storedFontSize;
    const effectiveReducedMotion =
      backendPrefs.reducedMotion !== undefined ? Boolean(backendPrefs.reducedMotion) : storedReducedMotion;
    const effectiveReadAloudRate =
      typeof backendPrefs.readAloudRate === 'number' ? backendPrefs.readAloudRate : storedReadAloudRate;
    const effectiveAudioSpeed =
      typeof backendPrefs.audioPlaybackSpeed === 'number' ? backendPrefs.audioPlaybackSpeed : storedAudioSpeed;
    const effectiveAutoReadAloud =
      backendPrefs.autoReadAloud !== undefined ? Boolean(backendPrefs.autoReadAloud) : storedAutoReadAloud;

    // 3. Update React states
    setIsHighContrast(effectiveContrast);
    setFontSizeState(effectiveFontSize);
    setReducedMotionState(effectiveReducedMotion);
    setReadAloudRateState(effectiveReadAloudRate);
    setAudioPlaybackSpeedState(effectiveAudioSpeed);
    setAutoReadAloudState(effectiveAutoReadAloud);

    // 4. Apply to DOM root
    applyDomAttributes(effectiveContrast, effectiveFontSize, effectiveReducedMotion);

    initializedRef.current = true;
  }, [user, applyDomAttributes]);

  // Synchronize a preference change to safe localStorage and backend
  const persistPreference = useCallback(
    async (key, value, backendField) => {
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, String(value));
      }

      // Sync with backend if authenticated
      if (user && authUpdatePreferences && backendField) {
        try {
          setIsSaving(true);
          await authUpdatePreferences({ [backendField]: value });
        } catch (err) {
          console.warn(`[AccessibilityContext] Failed to persist ${backendField} to backend:`, err);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [user, authUpdatePreferences]
  );

  // Set high contrast explicitly
  const setHighContrast = useCallback(
    (enabled) => {
      setIsHighContrast(enabled);
      applyDomAttributes(enabled, fontSize, reducedMotion);
      persistPreference(STORAGE_KEYS.CONTRAST, enabled ? 'high' : 'normal', 'highContrast');
      announce(enabled ? 'High contrast mode enabled' : 'Standard contrast mode restored');
    },
    [fontSize, reducedMotion, applyDomAttributes, persistPreference, announce]
  );

  // Toggle high contrast
  const toggleHighContrast = useCallback(() => {
    setHighContrast(!isHighContrast);
  }, [isHighContrast, setHighContrast]);

  // Set font size ('normal' | 'large' | 'xlarge')
  const setFontSize = useCallback(
    (newSize) => {
      const validSize = ['normal', 'large', 'xlarge'].includes(newSize) ? newSize : 'normal';
      setFontSizeState(validSize);
      applyDomAttributes(isHighContrast, validSize, reducedMotion);
      persistPreference(STORAGE_KEYS.FONT_SIZE, validSize, 'fontSize');

      const labels = { normal: 'Default (16px)', large: 'Large (18px)', xlarge: 'Extra Large (20px)' };
      announce(`Text size changed to ${labels[validSize] || validSize}`);
    },
    [isHighContrast, reducedMotion, applyDomAttributes, persistPreference, announce]
  );

  // Cycle font size (Default -> Large -> XLarge -> Default)
  const cycleFontSize = useCallback(() => {
    const sequence = ['normal', 'large', 'xlarge'];
    const nextIdx = (sequence.indexOf(fontSize) + 1) % sequence.length;
    setFontSize(sequence[nextIdx]);
  }, [fontSize, setFontSize]);

  // Set reduced motion
  const setReducedMotion = useCallback(
    (enabled) => {
      setReducedMotionState(enabled);
      applyDomAttributes(isHighContrast, fontSize, enabled);
      persistPreference(STORAGE_KEYS.REDUCED_MOTION, enabled ? 'true' : 'false', 'reducedMotion');
      announce(enabled ? 'Reduced motion enabled. Interface animations paused' : 'Motion restored to standard');
    },
    [isHighContrast, fontSize, applyDomAttributes, persistPreference, announce]
  );

  // Toggle reduced motion
  const toggleReducedMotion = useCallback(() => {
    setReducedMotion(!reducedMotion);
  }, [reducedMotion, setReducedMotion]);

  // Set read-aloud rate (0.75, 1.0, 1.25, 1.5)
  const setReadAloudRate = useCallback(
    (rate) => {
      const numRate = parseFloat(rate) || 1.0;
      setReadAloudRateState(numRate);
      persistPreference(STORAGE_KEYS.READ_ALOUD_RATE, numRate, 'readAloudRate');
      announce(`Read-aloud speed set to ${numRate}x`);
    },
    [persistPreference, announce]
  );

  // Set default audio playback speed (0.75, 1.0, 1.25, 1.5, 1.75, 2.0)
  const setAudioPlaybackSpeed = useCallback(
    (speed) => {
      const numSpeed = parseFloat(speed) || 1.0;
      setAudioPlaybackSpeedState(numSpeed);
      persistPreference(STORAGE_KEYS.AUDIO_SPEED, numSpeed, 'audioPlaybackSpeed');
      announce(`Audio playback speed set to ${numSpeed}x`);
    },
    [persistPreference, announce]
  );

  // Set auto read aloud
  const setAutoReadAloud = useCallback(
    (enabled) => {
      setAutoReadAloudState(enabled);
      persistPreference(STORAGE_KEYS.AUTO_READ_ALOUD, enabled ? 'true' : 'false', 'autoReadAloud');
      announce(enabled ? 'Auto read-aloud on section navigation enabled' : 'Auto read-aloud disabled');
    },
    [persistPreference, announce]
  );

  // Batch save multiple preferences
  const savePreferences = useCallback(
    async (partial) => {
      setIsSaving(true);
      try {
        if (partial.isHighContrast !== undefined || partial.highContrast !== undefined) {
          const val = partial.isHighContrast !== undefined ? partial.isHighContrast : partial.highContrast;
          setIsHighContrast(val);
          localStorage.setItem(STORAGE_KEYS.CONTRAST, val ? 'high' : 'normal');
        }
        if (partial.fontSize !== undefined) {
          setFontSizeState(partial.fontSize);
          localStorage.setItem(STORAGE_KEYS.FONT_SIZE, partial.fontSize);
        }
        if (partial.reducedMotion !== undefined) {
          setReducedMotionState(partial.reducedMotion);
          localStorage.setItem(STORAGE_KEYS.REDUCED_MOTION, partial.reducedMotion ? 'true' : 'false');
        }
        if (partial.readAloudRate !== undefined) {
          setReadAloudRateState(partial.readAloudRate);
          localStorage.setItem(STORAGE_KEYS.READ_ALOUD_RATE, String(partial.readAloudRate));
        }
        if (partial.audioPlaybackSpeed !== undefined) {
          setAudioPlaybackSpeedState(partial.audioPlaybackSpeed);
          localStorage.setItem(STORAGE_KEYS.AUDIO_SPEED, String(partial.audioPlaybackSpeed));
        }
        if (partial.autoReadAloud !== undefined) {
          setAutoReadAloudState(partial.autoReadAloud);
          localStorage.setItem(STORAGE_KEYS.AUTO_READ_ALOUD, partial.autoReadAloud ? 'true' : 'false');
        }

        const effectiveContrast = partial.highContrast ?? partial.isHighContrast ?? isHighContrast;
        const effectiveFontSize = partial.fontSize ?? fontSize;
        const effectiveMotion = partial.reducedMotion ?? reducedMotion;
        applyDomAttributes(effectiveContrast, effectiveFontSize, effectiveMotion);

        if (user && authUpdatePreferences) {
          await authUpdatePreferences({
            highContrast: effectiveContrast,
            fontSize: effectiveFontSize,
            reducedMotion: effectiveMotion,
            readAloudRate: partial.readAloudRate ?? readAloudRate,
            audioPlaybackSpeed: partial.audioPlaybackSpeed ?? audioPlaybackSpeed,
            autoReadAloud: partial.autoReadAloud ?? autoReadAloud
          });
        }
        announce('All accessibility preferences saved successfully');
      } catch (err) {
        console.error('[AccessibilityContext] Save error:', err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [isHighContrast, fontSize, reducedMotion, readAloudRate, audioPlaybackSpeed, autoReadAloud, user, authUpdatePreferences, applyDomAttributes, announce]
  );

  // Reset to platform defaults
  const resetToDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      setIsHighContrast(DEFAULT_PREFERENCES.isHighContrast);
      setFontSizeState(DEFAULT_PREFERENCES.fontSize);
      setReducedMotionState(DEFAULT_PREFERENCES.reducedMotion);
      setReadAloudRateState(DEFAULT_PREFERENCES.readAloudRate);
      setAudioPlaybackSpeedState(DEFAULT_PREFERENCES.audioPlaybackSpeed);
      setAutoReadAloudState(DEFAULT_PREFERENCES.autoReadAloud);

      applyDomAttributes(
        DEFAULT_PREFERENCES.isHighContrast,
        DEFAULT_PREFERENCES.fontSize,
        DEFAULT_PREFERENCES.reducedMotion
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CONTRAST, 'normal');
        localStorage.setItem(STORAGE_KEYS.FONT_SIZE, 'normal');
        localStorage.setItem(STORAGE_KEYS.REDUCED_MOTION, 'false');
        localStorage.setItem(STORAGE_KEYS.READ_ALOUD_RATE, '1');
        localStorage.setItem(STORAGE_KEYS.AUDIO_SPEED, '1');
        localStorage.setItem(STORAGE_KEYS.AUTO_READ_ALOUD, 'false');
      }

      if (user && authUpdatePreferences) {
        await authUpdatePreferences({
          highContrast: false,
          fontSize: 'normal',
          reducedMotion: false,
          readAloudRate: 1.0,
          audioPlaybackSpeed: 1.0,
          autoReadAloud: false
        });
      }
      announce('Accessibility preferences have been reset to default values');
    } catch (err) {
      console.warn('[AccessibilityContext] Reset warning:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user, authUpdatePreferences, applyDomAttributes, announce]);

  return (
    <AccessibilityContext.Provider
      value={{
        isHighContrast,
        fontSize,
        reducedMotion,
        readAloudRate,
        audioPlaybackSpeed,
        autoReadAloud,
        systemReducedMotion,
        isSaving,
        toggleHighContrast,
        setHighContrast,
        setFontSize,
        cycleFontSize,
        setReducedMotion,
        toggleReducedMotion,
        setReadAloudRate,
        setAudioPlaybackSpeed,
        setAutoReadAloud,
        savePreferences,
        resetToDefaults,
        announce
      }}
    >
      {children}
      {/* Live Region for Screen Reader Announcements (WCAG 4.1.3 Status Messages) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="accessibility-live-region"
      >
        {announcement}
      </div>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

export default AccessibilityContext;
