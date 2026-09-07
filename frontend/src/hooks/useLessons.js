'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../lib/apiClient';

export function useLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search, Filter, Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | IN_PROGRESS | COMPLETED | NOT_STARTED
  const [subjectFilter, setSubjectFilter] = useState('ALL'); // ALL | <subject_name>
  const [audioOnlyFilter, setAudioOnlyFilter] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // recent | newest | progress | mastery | title

  const fetchLessons = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);

    try {
      // Primary fetch: GET /api/lessons via apiClient (cached and deduplicated)
      let rawList = [];
      try {
        const data = await apiClient.get('/api/lessons', {
          bypassCache: options.forceRefresh
        });
        rawList = data?.lessons || (Array.isArray(data) ? data : []);
      } catch (primaryErr) {
        // Fallback: If /api/lessons endpoint isn't available, attempt GET /api/dashboard/progress
        const fallbackData = await apiClient.get('/api/dashboard/progress', {
          bypassCache: options.forceRefresh
        });
        const fallbackLessons = fallbackData?.lessons || [];
        rawList = fallbackLessons.map((l) => ({
          id: l.lessonId || l.id,
          title: l.title,
          subject: 'Science',
          status: l.status || 'PUBLISHED',
          progress: l.completionPercentage || 0,
          completionPercentage: l.completionPercentage || 0,
          masteryScore: 0,
          conceptCount: 3,
          hasAudio: Boolean(l.hasAudio),
          audioDurationSeconds: l.audioDurationSeconds || 0,
          lastActivity: l.lastAccessedAt,
          createdAt: l.lastAccessedAt || new Date().toISOString()
        }));
      }

      setLessons(rawList);
    } catch (err) {
      console.error('[useLessons] Error fetching lessons:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    return fetchLessons({ forceRefresh: true });
  }, [fetchLessons]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Extract unique subjects from backend data
  const availableSubjects = useMemo(() => {
    const subjects = new Set();
    lessons.forEach((l) => {
      if (l.subject && typeof l.subject === 'string') {
        subjects.add(l.subject.trim());
      }
    });
    return Array.from(subjects).sort();
  }, [lessons]);

  // Filtered & Sorted Lessons calculation
  const filteredLessons = useMemo(() => {
    let result = [...lessons];

    // 1. Search Query (matches title, subject, chapter, summary)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.subject?.toLowerCase().includes(q) ||
          l.chapterTitle?.toLowerCase().includes(q) ||
          l.summary?.toLowerCase().includes(q)
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((l) => {
        const s = (l.status || '').toUpperCase();
        if (statusFilter === 'COMPLETED') {
          return s === 'COMPLETED' || l.progress >= 100;
        }
        if (statusFilter === 'IN_PROGRESS') {
          return s === 'IN_PROGRESS' || (l.progress > 0 && l.progress < 100);
        }
        if (statusFilter === 'NOT_STARTED') {
          return s === 'NOT_STARTED' || s === 'PUBLISHED' || l.progress === 0;
        }
        return true;
      });
    }

    // 3. Subject Filter
    if (subjectFilter !== 'ALL') {
      result = result.filter(
        (l) => (l.subject || '').toLowerCase() === subjectFilter.toLowerCase()
      );
    }

    // 4. Audio Only Filter
    if (audioOnlyFilter) {
      result = result.filter((l) => Boolean(l.hasAudio));
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        const dateA = new Date(a.lastActivity || a.createdAt || 0).getTime();
        const dateB = new Date(b.lastActivity || b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'newest') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'progress') {
        return (b.progress || 0) - (a.progress || 0);
      }
      if (sortBy === 'mastery') {
        return (b.masteryScore || 0) - (a.masteryScore || 0);
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return result;
  }, [lessons, searchQuery, statusFilter, subjectFilter, audioOnlyFilter, sortBy]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSubjectFilter('ALL');
    setAudioOnlyFilter(false);
    setSortBy('recent');
  }, []);

  return {
    lessons,
    filteredLessons,
    availableSubjects,
    loading,
    error,
    refetch: fetchLessons,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    subjectFilter,
    setSubjectFilter,
    audioOnlyFilter,
    setAudioOnlyFilter,
    sortBy,
    setSortBy,
    resetFilters
  };
}
