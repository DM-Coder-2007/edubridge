'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import { API_ENDPOINTS } from '../config/api';

/**
 * Hook for fetching and managing real backend Dashboard data from Snowflake:
 * - GET /api/dashboard (Overview stats, student profile, recent activity)
 * - GET /api/dashboard/progress (Lesson completion and audio progress)
 * - GET /api/dashboard/mastery (Mastered and weak concepts analytics)
 */
export function useDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [masteryData, setMasteryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashRes, progRes, mastRes] = await Promise.all([
        apiClient.get(API_ENDPOINTS.DASHBOARD),
        apiClient.get(API_ENDPOINTS.DASHBOARD_PROGRESS).catch(() => null),
        apiClient.get(API_ENDPOINTS.DASHBOARD_MASTERY).catch(() => null)
      ]);

      setDashboardData(dashRes);
      setProgressData(progRes);
      setMasteryData(mastRes);
    } catch (err) {
      console.error('[useDashboard] Error fetching dashboard data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    dashboardData,
    progressData,
    masteryData,
    loading,
    error,
    refetch: fetchDashboardData
  };
}

export default useDashboard;
