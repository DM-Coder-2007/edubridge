'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContainer } from '../../components/shell';
import { ProtectedRoute } from '../../components/auth';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Badge,
  Spinner,
  LoadingSkeleton,
  EmptyState,
  ErrorState,
  ProgressBar
} from '../../components/ui';

import {
  ProgressOverview,
  ConceptMasteryCard,
  RadarChart
} from '../../components/progress';

export default function StudentProgressCenterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Backend real data states
  const [dashboardData, setDashboardData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [masteryData, setMasteryData] = useState(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  /**
   * Fetch Real Backend Progress, Dashboard, and Mastery Data
   */
  const loadProgressAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Parallel fetch to real Express endpoints
      const [dashRes, progRes, mastRes] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/dashboard/progress`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/dashboard/mastery`, { credentials: 'include' })
      ]);

      if (!dashRes.ok) {
        const err = await dashRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to fetch student dashboard (${dashRes.status})`);
      }

      const dashJson = await dashRes.json();
      const progJson = progRes.ok ? await progRes.json() : { data: {} };
      const mastJson = mastRes.ok ? await mastRes.json() : { data: {} };

      setDashboardData(dashJson.data || {});
      setProgressData(progJson.data || {});
      setMasteryData(mastJson.data || {});
    } catch (err) {
      console.error('[StudentProgressCenter] Fetch error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    loadProgressAnalytics();
  }, [loadProgressAnalytics]);

  // Extract combined concept list from real backend mastery data
  const { allConcepts, masteredConcepts, weakConcepts, proficientConcepts } = React.useMemo(() => {
    const breakdown = masteryData?.breakdown || {};
    const mastered = breakdown.mastered || [];
    const proficient = breakdown.proficient || [];
    const weak = breakdown.weak || [];

    // All combined concepts
    const combined = [...mastered, ...proficient, ...weak];

    return {
      allConcepts: combined,
      masteredConcepts: mastered,
      weakConcepts: weak,
      proficientConcepts: proficient
    };
  }, [masteryData]);

  // Prepare radar chart items from real concept names and scores (do not fabricate)
  const radarItems = React.useMemo(() => {
    return allConcepts.map((c) => ({
      label: c.conceptName || c.conceptId || 'Core Concept',
      value: c.masteryScore ?? 0,
      attempts: c.attemptsCount ?? 0,
      level: c.masteryScore >= 80 ? 'Strong' : c.masteryScore < 60 ? 'Needs Practice' : 'Developing'
    }));
  }, [allConcepts]);

  // Lessons list from real progress data
  const lessons = progressData?.lessons || [];

  // Recent activity from real dashboard overview
  const recentAttempts = dashboardData?.recentActivity?.recentAttempts || [];
  const recentLessons = dashboardData?.recentActivity?.recentLessons || [];

  // Handle Practice click: redirect to first lesson or practice quiz
  const handlePractice = (concept) => {
    if (lessons.length > 0) {
      // Find lesson matching concept if available, else first lesson
      const targetLesson = lessons[0];
      router.push(`/lessons/${targetLesson.lessonId}/quiz`);
    } else {
      router.push('/lessons');
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Student Progress' }
  ];

  return (
    <ProtectedRoute>
      <PageContainer breadcrumbs={breadcrumbs}>
        <div className="progress-container">
          {/* Header */}
          <div className="progress-header">
            <div>
              <h1 className="h2" style={{ margin: 0 }}>Student Progress Center</h1>
              <p className="text-secondary" style={{ marginTop: 'var(--spacing-1)' }}>
                Comprehensive mastery analytics, cognitive strengths, and adaptive reinforcement schedules.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadProgressAnalytics}
              disabled={loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Refresh Metrics</span>
            </Button>
          </div>

          {/* 1. Loading State */}
          {loading && (
            <LoadingSkeleton
              preset="page"
              ariaLabel="Loading student mastery profile and progress records from Snowflake"
            />
          )}

          {/* 2. Error State */}
          {!loading && error && (
            <ErrorState
              error={error}
              title="Failed to Load Progress Analytics"
              onRetry={loadProgressAnalytics}
              retryText="Try Again"
              secondaryAction={
                <Link href="/dashboard">
                  <Button variant="outline">Return to Dashboard</Button>
                </Link>
              }
            />
          )}


          {/* Live Progress Data Presentation */}
          {!loading && !error && (
            <>
              {/* 1. Overview Metric Cards */}
              <ProgressOverview
                overview={dashboardData?.overview || {}}
                progressSummary={progressData?.summary || {}}
              />

              {/* 2. Visual Radar Chart & Table View */}
              <Card>
                <CardBody>
                  <RadarChart
                    items={radarItems}
                    title="Concept Mastery Dimensionality"
                    description="Real-time multi-concept performance mapping from Snowflake learning attempts."
                  />
                </CardBody>
              </Card>

              {/* 3. Focus Areas: Weak Areas vs Strong Areas */}
              <section className="progress-split-layout" aria-label="Targeted Learning Areas">
                {/* Weak Areas (Needs Practice / Reinforcement) */}
                <div className="focus-area-card">
                  <div className="focus-area-header">
                    <div>
                      <h2 className="text-h3" style={{ margin: 0, color: 'var(--color-danger-700)' }}>
                        Concepts Requiring Practice
                      </h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                        Prioritized for tactile analogies and spaced repetition
                      </p>
                    </div>
                    <Badge variant="danger">{weakConcepts.length} Weak</Badge>
                  </div>

                  {weakConcepts.length > 0 ? (
                    <div className="stack-sm">
                      {weakConcepts.map((w, idx) => (
                        <div key={idx} className="focus-item-row">
                          <div className="focus-item-info">
                            <strong style={{ fontSize: '1rem' }}>
                              {w.conceptName || w.conceptId}
                            </strong>
                            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                              Mastery: {w.masteryScore}% • {w.attemptsCount || 1} attempts
                            </span>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handlePractice(w)}
                          >
                            Practice
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center" style={{ padding: 'var(--spacing-6) 0', color: 'var(--text-secondary)' }}>
                      <p>🎉 Excellent work! You currently have no struggling concepts.</p>
                    </div>
                  )}
                </div>

                {/* Strong Areas (Mastered Concepts) */}
                <div className="focus-area-card">
                  <div className="focus-area-header">
                    <div>
                      <h2 className="text-h3" style={{ margin: 0, color: 'var(--color-success-700)' }}>
                        Mastered Concepts
                      </h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                        Demonstrated high comprehension (≥ 80% accuracy)
                      </p>
                    </div>
                    <Badge variant="success">{masteredConcepts.length} Mastered</Badge>
                  </div>

                  {masteredConcepts.length > 0 ? (
                    <div className="stack-sm">
                      {masteredConcepts.map((m, idx) => (
                        <div key={idx} className="focus-item-row">
                          <div className="focus-item-info">
                            <strong style={{ fontSize: '1rem' }}>
                              {m.conceptName || m.conceptId}
                            </strong>
                            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                              Score: {m.masteryScore}% • {m.attemptsCount || 1} attempts
                            </span>
                          </div>
                          <Badge variant="success">Mastered</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center" style={{ padding: 'var(--spacing-6) 0', color: 'var(--text-secondary)' }}>
                      <p>Complete lesson comprehension quizzes to build your mastered concepts.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* 4. Visual Concept Mastery Cards (Grid of all concepts) */}
              <section aria-label="All Tracked Concepts">
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <h2 className="text-h2" style={{ margin: 0 }}>All Concept Masteries</h2>
                  <p className="text-secondary" style={{ marginTop: 'var(--spacing-1)' }}>
                    Detailed progress breakdown for every learning objective across your lessons.
                  </p>
                </div>

                {allConcepts.length > 0 ? (
                  <div className="concept-cards-grid">
                    {allConcepts.map((concept, idx) => (
                      <ConceptMasteryCard
                        key={concept.id || idx}
                        concept={concept}
                        onPractice={handlePractice}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No Concept Mastery Recorded Yet"
                    description="Complete lessons and practice quizzes to begin tracking your mastery and spaced repetition progress."
                    action={
                      <Link href="/lessons">
                        <Button variant="primary">Browse Lessons Library</Button>
                      </Link>
                    }
                  />

                )}
              </section>

              {/* 5. Recent Learning Activity */}
              {recentAttempts.length > 0 && (
                <section aria-label="Recent Learning Activity">
                  <h2 className="text-h2" style={{ marginBottom: 'var(--spacing-4)' }}>
                    Recent Assessment Activity
                  </h2>
                  <div className="activity-list">
                    {recentAttempts.map((attempt, idx) => (
                      <div key={idx} className="activity-item">
                        <div>
                          <strong>{attempt.conceptId || 'Lesson Assessment'}</strong>
                          <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
                            {attempt.createdAt ? new Date(attempt.createdAt).toLocaleString() : 'Recent attempt'}
                          </div>
                        </div>
                        <Badge variant={attempt.score >= 80 ? 'success' : attempt.score >= 60 ? 'warning' : 'danger'}>
                          Score: {attempt.score}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
