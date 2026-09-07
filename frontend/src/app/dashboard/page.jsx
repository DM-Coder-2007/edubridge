'use client';

import React from 'react';
import Link from 'next/link';
import { PageContainer } from '../../components/shell';
import { ProtectedRoute } from '../../components/auth';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Button,
  ProgressBar,
  Skeleton,
  EmptyState,
  ErrorState
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { getTimeBasedGreeting, formatRelativeTime, formatConceptName } from '../../lib/formatters';
import { getReadableErrorMessage } from '../../lib/errorHandler';

export default function DashboardPage() {
  const { user } = useAuth();
  const { dashboardData, progressData, masteryData, loading, error, refetch } = useDashboard();

  // Determine student display name
  const studentName = dashboardData?.student?.fullName || user?.fullName || 'Student';
  const greeting = getTimeBasedGreeting(studentName);

  // Extract metrics from real backend response
  const overview = dashboardData?.overview || {};
  const completedLessons = progressData?.summary?.completedLessons ?? 0;
  const totalAttempts = overview.totalAttempts ?? 0;
  const overallMastery = overview.overallMasteryScore ?? 0;
  const totalConcepts = overview.totalConceptsTracked ?? 0;

  // Identify in-progress or most recently accessed lesson
  const inProgressLesson = progressData?.lessons?.find(
    (l) => l.status === 'IN_PROGRESS' || (l.completionPercentage > 0 && l.completionPercentage < 100)
  ) || progressData?.lessons?.[0] || dashboardData?.recentActivity?.recentLessons?.[0] || null;

  // Extract weak concepts (< 60%) and strong concepts (>= 85%)
  const weakConcepts = masteryData?.breakdown?.weak || [];
  const strongConcepts = masteryData?.breakdown?.mastered || [];
  const recentLessons = dashboardData?.recentActivity?.recentLessons || [];

  // Check if student has zero activity
  const isNewStudent = !loading && (overview.totalLessons === 0 || !overview.totalLessons) && (overview.totalTextbooks === 0 || !overview.totalTextbooks);

  return (
    <ProtectedRoute>
      <PageContainer>
        <div className="stack-lg">
          {/* Header Command Center */}
          <header className="stack-sm">
            <h1 className="text-h1">{greeting}</h1>
            <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
              Continue your learning journey.
            </p>
          </header>

          {/* Error State Handler */}
          {error && !loading && (
            <ErrorState
              error={error}
              title="Unable to load dashboard data"
              retryText="Retry Connection"
              onRetry={refetch}
            />
          )}


          {/* Loading Skeleton View */}
          {loading && (
            <div className="stack-lg" aria-busy="true" aria-label="Loading your dashboard">
              <div className="grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardBody>
                      <Skeleton variant="text" width="60%" />
                      <div style={{ margin: 'var(--spacing-2) 0' }}>
                        <Skeleton variant="rect" height={36} width="40%" />
                      </div>
                      <Skeleton variant="text" width="80%" />
                    </CardBody>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 grid-cols-md-2 gap-6">
                <Card>
                  <CardBody>
                    <Skeleton variant="text" width="40%" />
                    <div style={{ margin: 'var(--spacing-3) 0' }}>
                      <Skeleton variant="rect" height={100} />
                    </div>
                    <Skeleton variant="rect" height={40} width={160} />
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <Skeleton variant="text" width="50%" />
                    <div style={{ margin: 'var(--spacing-3) 0' }}>
                      <Skeleton variant="rect" height={100} />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {/* Empty State for New Students */}
          {isNewStudent && !error && (
            <EmptyState
              title="No lessons yet"
              description="Upload your first textbook page scan to generate multimodal accessible lessons with Piper TTS narration and tactile analogies."
              icon={
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              }
              action={
                <Link href="/textbooks">
                  <Button variant="primary">
                    Upload Textbook
                  </Button>
                </Link>
              }
            />
          )}

          {/* Active Learning Dashboard */}
          {!loading && !error && !isNewStudent && (
            <>
              {/* Summary Metrics Cards */}
              <section aria-label="Learning Metrics Overview">
                <div className="grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-4 gap-4">
                  {/* Lessons Completed */}
                  <Card>
                    <CardBody>
                      <div className="text-small" style={{ color: 'var(--text-muted)' }}>Lessons Completed</div>
                      <div className="text-display" style={{ margin: 'var(--spacing-1) 0' }}>
                        {completedLessons}
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-primary-700)' }}>
                        of {overview.totalLessons || completedLessons} total lessons
                      </div>
                    </CardBody>
                  </Card>

                  {/* Questions Answered */}
                  <Card>
                    <CardBody>
                      <div className="text-small" style={{ color: 'var(--text-muted)' }}>Questions Answered</div>
                      <div className="text-display" style={{ margin: 'var(--spacing-1) 0' }}>
                        {totalAttempts}
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-accent-700)' }}>
                        Adaptive assessments
                      </div>
                    </CardBody>
                  </Card>

                  {/* Overall Mastery */}
                  <Card>
                    <CardBody>
                      <div className="text-small" style={{ color: 'var(--text-muted)' }}>Overall Mastery</div>
                      <div className="text-display" style={{ margin: 'var(--spacing-1) 0', color: overallMastery >= 80 ? 'var(--color-success-700)' : 'var(--color-primary-700)' }}>
                        {overallMastery}%
                      </div>
                      <div className="text-caption" style={{ color: overallMastery >= 80 ? 'var(--color-success-700)' : 'var(--text-secondary)' }}>
                        {overallMastery >= 85 ? 'Mastered tier' : overallMastery >= 60 ? 'Proficient tier' : 'Developing tier'}
                      </div>
                    </CardBody>
                  </Card>

                  {/* Concepts Tracked */}
                  <Card>
                    <CardBody>
                      <div className="text-small" style={{ color: 'var(--text-muted)' }}>Concepts Tracked</div>
                      <div className="text-display" style={{ margin: 'var(--spacing-1) 0' }}>
                        {totalConcepts}
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-success-700)' }}>
                        {overview.masteredConceptsCount || strongConcepts.length} mastered in Snowflake
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </section>

              {/* Prominent Continue Learning Section */}
              {inProgressLesson && (
                <section aria-label="Continue Current Lesson">
                  <Card interactive style={{ borderLeft: '4px solid var(--color-primary-600)' }}>
                    <CardHeader>
                      <div>
                        <span className="text-caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary-700)', fontWeight: 'bold' }}>
                          Continue Learning
                        </span>
                        <CardTitle style={{ marginTop: 'var(--spacing-1)' }}>
                          {inProgressLesson.title || 'Accessible Lesson'}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        {inProgressLesson.hasAudio && <Badge variant="primary">Piper Audio</Badge>}
                        {inProgressLesson.difficultyLevel && (
                          <Badge variant="neutral">
                            {inProgressLesson.difficultyLevel}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardBody>
                      <div className="stack">
                        <ProgressBar
                          value={inProgressLesson.completionPercentage || 45}
                          showPercentage
                          label="Lesson Progress"
                          variant="primary"
                        />

                        <div className="flex justify-between items-center flex-wrap gap-2 text-small" style={{ color: 'var(--text-muted)' }}>
                          <span>
                            Last active: {formatRelativeTime(inProgressLesson.lastAccessedAt)}
                          </span>
                          {inProgressLesson.audioDurationSeconds > 0 && (
                            <span>
                              Narration: {Math.round(inProgressLesson.audioDurationSeconds / 60)} min
                            </span>
                          )}
                        </div>

                        <div>
                          <Link href={`/lessons/${inProgressLesson.lessonId || inProgressLesson.id || 'current'}`}>
                            <Button variant="primary">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              <span>Continue Lesson</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </section>
              )}

              {/* Adaptive Mastery Breakdown: Weak Concepts & Strong Concepts */}
              <section aria-label="Conceptual Mastery Diagnostics">
                <div className="grid grid-cols-1 grid-cols-md-2 gap-6">
                  {/* Weak Concepts (Requiring Reinforcement) */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Concepts Requiring Practice</CardTitle>
                      <Badge variant="warning">{weakConcepts.length} Weak</Badge>
                    </CardHeader>
                    <CardBody>
                      {weakConcepts.length === 0 ? (
                        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
                          No struggling concepts identified. All assessed concepts meet proficiency criteria!
                        </p>
                      ) : (
                        <div className="stack">
                          {weakConcepts.map((item, idx) => {
                            const name = formatConceptName(item);
                            const score = item.masteryScore ?? item.currentMasteryScore ?? 45;
                            return (
                              <div
                                key={item.conceptId || idx}
                                style={{
                                  padding: 'var(--spacing-3)',
                                  backgroundColor: 'var(--color-warning-50)',
                                  border: '1px solid var(--color-warning-100)',
                                  borderRadius: 'var(--radius-md)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 'var(--spacing-2)'
                                }}
                              >
                                <div>
                                  <div className="text-body-strong" style={{ color: 'var(--color-warning-900)' }}>
                                    {name}
                                  </div>
                                  <div className="flex items-center gap-2" style={{ marginTop: 'var(--spacing-1)' }}>
                                    <span className="text-small" style={{ fontWeight: 'bold' }}>{score}%</span>
                                    <Badge variant="warning">Needs Practice</Badge>
                                  </div>
                                </div>

                                <Link href={`/lessons?concept=${encodeURIComponent(item.conceptId || name)}`}>
                                  <Button variant="outline" size="sm">
                                    Practice
                                  </Button>
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  {/* Strong Concepts (Mastered >= 85%) */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Mastered Concepts</CardTitle>
                      <Badge variant="success">{strongConcepts.length} Mastered</Badge>
                    </CardHeader>
                    <CardBody>
                      {strongConcepts.length === 0 ? (
                        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
                          Continue practicing to reach 85%+ mastery on your lesson concepts.
                        </p>
                      ) : (
                        <div className="stack">
                          {strongConcepts.map((item, idx) => {
                            const name = formatConceptName(item);
                            const score = item.masteryScore ?? 90;
                            return (
                              <div
                                key={item.conceptId || idx}
                                style={{
                                  padding: 'var(--spacing-3)',
                                  backgroundColor: 'var(--color-success-50)',
                                  border: '1px solid var(--color-success-100)',
                                  borderRadius: 'var(--radius-md)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <div>
                                  <div className="text-body-strong" style={{ color: 'var(--color-success-900)' }}>
                                    {name}
                                  </div>
                                  <div className="flex items-center gap-2" style={{ marginTop: 'var(--spacing-1)' }}>
                                    <span className="text-small" style={{ fontWeight: 'bold' }}>{score}%</span>
                                    <Badge variant="success">Mastered</Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              </section>

              {/* Recent Lessons from Real Backend */}
              {recentLessons.length > 0 && (
                <section aria-label="Recent Accessible Lessons">
                  <h2 className="text-h2" style={{ marginBottom: 'var(--spacing-4)' }}>
                    Recent Lessons
                  </h2>

                  <div className="grid grid-cols-1 grid-cols-md-3 gap-4">
                    {recentLessons.map((lesson) => (
                      <Card key={lesson.id} interactive>
                        <CardHeader>
                          <CardTitle style={{ fontSize: '1.1rem' }}>{lesson.title}</CardTitle>
                          {lesson.difficultyLevel && (
                            <Badge variant="neutral">{lesson.difficultyLevel}</Badge>
                          )}
                        </CardHeader>
                        <CardBody>
                          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-3)' }}>
                            {lesson.summary || lesson.simplifiedText || 'Sensory analogy and multimodal lesson.'}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-caption">
                              {formatRelativeTime(lesson.createdAt)}
                            </span>
                            <Link href={`/lessons/${lesson.id}`}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                          </div>
                        </CardBody>
                      </Card>
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
