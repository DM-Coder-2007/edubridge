'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../lib/apiClient';

/**
 * In-memory lesson player session cache to avoid fetching the same lesson repeatedly.
 * Bounded with a 60-second TTL to guarantee fresh progress updates while eliminating
 * redundant round-trips during back/forward navigation.
 */
const lessonSessionCache = new Map();
const LESSON_CACHE_TTL = 60 * 1000;

export function useLessonPlayer(lessonId) {
  const [lesson, setLesson] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [masteryData, setMasteryData] = useState(null);
  const [textbook, setTextbook] = useState(null);
  const [progress, setProgress] = useState({
    completionPercentage: 0,
    lastAudioPositionSeconds: 0,
    status: 'NOT_STARTED'
  });
  const [previousLessonId, setPreviousLessonId] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);

  const lastProgressSyncRef = useRef(0);

  /**
   * Fetch lesson details, questions, mastery, and adjacent lessons concurrently
   */
  const fetchLessonData = useCallback(async (options = {}) => {
    if (!lessonId) return;

    // Check session cache if not explicitly bypassing
    const cacheKey = `lesson_${lessonId}`;
    const cached = lessonSessionCache.get(cacheKey);
    if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
      setLesson(cached.lesson);
      setQuestions(cached.questions);
      setMasteryData(cached.masteryData);
      setTextbook(cached.textbook);
      setProgress(cached.progress);
      setPreviousLessonId(cached.previousLessonId);
      setNextLessonId(cached.nextLessonId);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Primary Lesson Data first
      const lessonData = await apiClient.get(`/api/lessons/${lessonId}`, {
        bypassCache: options.forceRefresh
      });

      const rawLesson = lessonData?.lesson || lessonData;
      if (!rawLesson || (!rawLesson.id && !rawLesson.title)) {
        throw new Error('Lesson not found or invalid format returned.');
      }

      const rawAudio = lessonData?.audio;
      const mergedLesson = {
        ...rawLesson,
        audioUrl: rawLesson.audioUrl || rawAudio?.audioUrl || null,
        waveformUrl: rawLesson.waveformUrl || rawAudio?.waveformUrl || null,
        audioDurationSeconds: rawLesson.audioDurationSeconds || rawAudio?.durationSeconds || 0
      };
      setLesson(mergedLesson);

      // 2. Parallel Secondary Fetches (eliminated 5 sequential waterfalls)
      const tbId = rawLesson.textbookAssetId || rawLesson.textbookId;
      const [qResult, mResult, tbResult, allResult, progResult] = await Promise.allSettled([
        apiClient.get(`/api/lessons/${lessonId}/questions`),
        apiClient.get(`/api/lessons/${lessonId}/mastery`),
        tbId && tbId !== 'txt_default' ? apiClient.get(`/api/textbooks/${tbId}`) : Promise.resolve(null),
        apiClient.get('/api/lessons'),
        apiClient.get('/api/progress')
      ]);

      // Resolve questions
      let resolvedQuestions = [];
      if (qResult.status === 'fulfilled' && qResult.value) {
        resolvedQuestions = qResult.value.questions || (Array.isArray(qResult.value) ? qResult.value : []);
        setQuestions(resolvedQuestions);
      }

      // Resolve mastery
      let resolvedMastery = null;
      if (mResult.status === 'fulfilled' && mResult.value) {
        resolvedMastery = mResult.value;
        setMasteryData(resolvedMastery);
      }

      // Resolve textbook
      let resolvedTextbook = null;
      if (tbResult.status === 'fulfilled' && tbResult.value) {
        resolvedTextbook = tbResult.value.textbook || tbResult.value;
        setTextbook(resolvedTextbook);
      }

      // Resolve adjacent lessons
      let prevId = null;
      let nextId = null;
      if (allResult.status === 'fulfilled' && allResult.value) {
        const allLessons = allResult.value.lessons || (Array.isArray(allResult.value) ? allResult.value : []);
        const currentIndex = allLessons.findIndex((l) => (l.id || l.lessonId) === lessonId);
        if (currentIndex > 0) {
          prevId = allLessons[currentIndex - 1].id || allLessons[currentIndex - 1].lessonId;
        }
        if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
          nextId = allLessons[currentIndex + 1].id || allLessons[currentIndex + 1].lessonId;
        }
        setPreviousLessonId(prevId);
        setNextLessonId(nextId);
      }

      // Resolve student progress
      let resolvedProgress = {
        completionPercentage: 0,
        lastAudioPositionSeconds: 0,
        status: 'NOT_STARTED'
      };
      if (progResult.status === 'fulfilled' && progResult.value) {
        const progressList = progResult.value.progress || (Array.isArray(progResult.value) ? progResult.value : []);
        const lessonProg = progressList.find((p) => p.lessonId === lessonId);
        if (lessonProg) {
          resolvedProgress = {
            completionPercentage: lessonProg.completionPercentage || 0,
            lastAudioPositionSeconds: lessonProg.lastAudioPositionSeconds || 0,
            status: lessonProg.status || 'IN_PROGRESS'
          };
          setProgress(resolvedProgress);
        }
      }

      // Save assembled session cache
      lessonSessionCache.set(cacheKey, {
        lesson: mergedLesson,
        questions: resolvedQuestions,
        masteryData: resolvedMastery,
        textbook: resolvedTextbook,
        progress: resolvedProgress,
        previousLessonId: prevId,
        nextLessonId: nextId,
        expiresAt: Date.now() + LESSON_CACHE_TTL
      });
    } catch (err) {
      console.error('[useLessonPlayer] Error fetching lesson:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchLessonData();
  }, [fetchLessonData]);

  /**
   * Sync reading or audio progress to Snowflake backend
   */
  const updateProgress = useCallback(
    async ({ completionPercentage, lastAudioPositionSeconds, status }) => {
      if (!lessonId) return;

      const now = Date.now();
      // Throttle rapid progress updates to at most once every 3 seconds
      if (now - lastProgressSyncRef.current < 3000 && completionPercentage !== 100) {
        return;
      }
      lastProgressSyncRef.current = now;

      try {
        const data = await apiClient.put(`/api/progress/lesson/${lessonId}`, {
          completionPercentage,
          lastAudioPositionSeconds,
          status: status || (completionPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS')
        });

        const updated = data?.progress || data;
        if (updated) {
          const newProgress = {
            completionPercentage: updated.completionPercentage ?? completionPercentage,
            lastAudioPositionSeconds: updated.lastAudioPositionSeconds ?? lastAudioPositionSeconds,
            status: updated.status ?? (completionPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS')
          };
          setProgress(newProgress);

          // Update cache with updated progress
          const cacheKey = `lesson_${lessonId}`;
          const cached = lessonSessionCache.get(cacheKey);
          if (cached) {
            cached.progress = newProgress;
          }
        }
      } catch (err) {
        console.warn('[useLessonPlayer] Failed to sync progress:', err.message);
      }
    },
    [lessonId]
  );

  /**
   * On-demand Piper TTS Narration Synthesis
   */
  const synthesizeAudio = useCallback(async () => {
    if (!lessonId || isAudioGenerating) return;

    setIsAudioGenerating(true);
    try {
      const data = await apiClient.post(`/api/lessons/${lessonId}/audio`, {});
      const newAudio = data?.audio || data;
      if (newAudio) {
        setLesson((prev) => {
          const updated = {
            ...prev,
            audioUrl: newAudio.audioUrl,
            waveformUrl: newAudio.waveformUrl,
            audioDurationSeconds: newAudio.durationSeconds || newAudio.audioDurationSeconds
          };
          // Update cache with new audio
          const cacheKey = `lesson_${lessonId}`;
          const cached = lessonSessionCache.get(cacheKey);
          if (cached) {
            cached.lesson = updated;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('[useLessonPlayer] Audio synthesis failed:', err);
    } finally {
      setIsAudioGenerating(false);
    }
  }, [lessonId, isAudioGenerating]);

  const refetch = useCallback(() => {
    return fetchLessonData({ forceRefresh: true });
  }, [fetchLessonData]);

  return {
    lesson,
    questions,
    masteryData,
    textbook,
    progress,
    loading,
    error,
    refetch,
    updateProgress,
    synthesizeAudio,
    isAudioGenerating,
    previousLessonId,
    nextLessonId,
    activeSection,
    setActiveSection
  };
}
