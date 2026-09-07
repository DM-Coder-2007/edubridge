'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const AUDIO_CACHE_NAME = 'edubridge-audio-cache-v1';

/**
 * useOfflineAudio
 *
 * Provides student-controlled offline caching for lesson audio via Service Worker & Cache API.
 * Strict Guardrails:
 * - Does NOT download media without explicit user intent.
 * - Caches ONLY specific lesson audio approved by the student.
 * - Does NOT cache sensitive user credentials or personal APIs.
 *
 * @param {string} lessonId
 * @param {string} audioUrl
 */
export function useOfflineAudio(lessonId, audioUrl) {
  const [isCached, setIsCached] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [cacheError, setCacheError] = useState(null);
  const [offlineAudioUrl, setOfflineAudioUrl] = useState(null);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );

  const activeBlobUrlRef = useRef(null);

  // Track browser network connectivity (online vs offline)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Check if current audioUrl is present in Cache API storage
   */
  const checkCacheStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window) || !audioUrl) {
      setIsCached(false);
      return;
    }

    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(audioUrl);
      if (match) {
        setIsCached(true);
        const blob = await match.blob();
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        const blobUrl = URL.createObjectURL(blob);
        activeBlobUrlRef.current = blobUrl;
        setOfflineAudioUrl(blobUrl);
      } else {
        setIsCached(false);
        setOfflineAudioUrl(null);
      }
    } catch (err) {
      console.warn('[useOfflineAudio] Cache check warning:', err.message);
      setIsCached(false);
    }
  }, [audioUrl]);

  useEffect(() => {
    checkCacheStatus();

    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [checkCacheStatus]);

  /**
   * Explicit User Intent: Download and store audio for offline study
   */
  const downloadForOffline = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window)) {
      setCacheError('Offline audio caching is not supported in this browser.');
      return false;
    }
    if (!audioUrl) {
      setCacheError('No audio narration available to download.');
      return false;
    }

    setIsCaching(true);
    setCacheError(null);

    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);

      // Fetch with cors mode
      const response = await fetch(audioUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Cloudinary audio stream (${response.status})`);
      }

      await cache.put(audioUrl, response.clone());
      const blob = await response.blob();

      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = blobUrl;
      setOfflineAudioUrl(blobUrl);
      setIsCached(true);
      return true;
    } catch (err) {
      console.error('[useOfflineAudio] Caching failed:', err);
      // Handle storage quota limits gracefully
      let msg = err.message || 'Failed to download audio for offline listening.';
      if (err.name === 'QuotaExceededError' || msg.toLowerCase().includes('quota')) {
        msg = 'Browser storage quota exceeded. Please remove other offline copies before saving new audio.';
      }
      setCacheError(msg);
      return false;
    } finally {
      setIsCaching(false);
    }
  }, [audioUrl]);

  /**
   * Explicit User Intent: Remove offline copy from storage
   */
  const removeFromOffline = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window) || !audioUrl) {
      return;
    }

    setIsRemoving(true);
    setCacheError(null);

    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      await cache.delete(audioUrl);
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setOfflineAudioUrl(null);
      setIsCached(false);
    } catch (err) {
      console.error('[useOfflineAudio] Removal error:', err);
      setCacheError('Failed to remove audio from cache.');
    } finally {
      setIsRemoving(false);
    }
  }, [audioUrl]);

  // Determine active audio source:
  // If offline, must use cached blob URL; if online, prefers cached copy if available, else stream
  const effectiveAudioUrl = !isOnline && offlineAudioUrl ? offlineAudioUrl : (offlineAudioUrl || audioUrl);
  const audioSourceType = (!isOnline && offlineAudioUrl) || (isCached && offlineAudioUrl)
    ? 'OFFLINE_CACHE'
    : 'ONLINE_STREAM';

  return {
    isCached,
    isCaching,
    isRemoving,
    cacheError,
    offlineAudioUrl,
    effectiveAudioUrl,
    audioSourceType,
    isOnline,
    downloadForOffline,
    removeFromOffline,
    checkCacheStatus
  };
}
