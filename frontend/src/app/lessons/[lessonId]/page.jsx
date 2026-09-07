'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageContainer } from '../../../components/shell';
import { ProtectedRoute } from '../../../components/auth';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Skeleton,
  ProgressBar,
  ErrorState
} from '../../../components/ui';
import { useLessonPlayer } from '../../../hooks/useLessonPlayer';
import {
  AudioPlayer,
  LessonContent,
  LessonQuestions,
  LessonNavigationSidebar
} from '../../../components/lessons';
import { ReadAloud } from '../../../components/accessibility/ReadAloud';
import { getReadableErrorMessage } from '../../../lib/errorHandler';

export default function LessonPlayerPage() {
  const params = useParams();
  const lessonId = params?.lessonId;

  const {
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
  } = useLessonPlayer(lessonId);

  if (loading) {
    return (
      <ProtectedRoute>
        <PageContainer>
          <div className="stack-lg" aria-busy="true" aria-label="Loading lesson player">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="stack-xs" style={{ width: '60%' }}>
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="90%" />
              </div>
              <Skeleton variant="rect" height={40} width={140} />
            </div>

            <div className="lesson-player-layout">
              <Card>
                <CardBody>
                  <Skeleton variant="rect" height={220} />
                </CardBody>
              </Card>

              <div className="stack-lg">
                <Skeleton variant="rect" height={100} />
                <Skeleton variant="rect" height={320} />
                <Skeleton variant="rect" height={200} />
              </div>
            </div>
          </div>
        </PageContainer>
      </ProtectedRoute>
    );
  }

  if (error || !lesson) {
    return (
      <ProtectedRoute>
        <PageContainer>
          <div className="stack-lg">
            <ErrorState
              error={error || { code: 'LESSON_NOT_FOUND', message: 'The requested lesson could not be found or has not been generated yet.' }}
              title="Unable to load lesson"
              retryText="Retry Loading"
              onRetry={refetch}
              secondaryAction={
                <Link href="/lessons">
                  <Button variant="outline">Back to My Lessons Library</Button>
                </Link>
              }
            />

          </div>
        </PageContainer>
      </ProtectedRoute>
    );
  }

  const title = lesson.title || 'Accessible Lesson';
  const subject = textbook?.subject || 'General Science';
  const chapterTitle = textbook?.chapterTitle;
  const progressPercentage = progress.completionPercentage || 0;
  const masteryScore =
    masteryData?.overallMasteryScore !== undefined
      ? masteryData.overallMasteryScore
      : progress.masteryScore || 0;
  const totalQuestions = questions.length;
  const questionsAnswered = 0; // Or from student quiz attempts
  const conceptCount =
    textbook?.metadata?.concepts?.length || lesson.keyTakeaways?.length || 3;

  return (
    <ProtectedRoute>
      <PageContainer>
        <div className="stack-lg">
          {/* Breadcrumb Navigation & Top Action */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-small" style={{ listStyle: 'none', padding: 0 }}>
                <li>
                  <Link href="/lessons" className="text-primary font-medium">
                    Lessons
                  </Link>
                </li>
                <li aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                  /
                </li>
                <li style={{ color: 'var(--text-secondary)' }}>{subject}</li>
                <li aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                  /
                </li>
                <li className="font-semibold text-primary" aria-current="page" style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title}
                </li>
              </ol>
            </nav>

            <Link href="/lessons">
              <Button variant="ghost" size="sm">
                ← Back to Lessons Library
              </Button>
            </Link>
          </div>

          {/* 1. Mobile & Desktop Unified Header */}
          <header className="flex items-center justify-between flex-wrap gap-4">
            <div className="stack-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="primary">{subject}</Badge>
                {chapterTitle && <Badge variant="secondary">{chapterTitle}</Badge>}
                <Badge variant={progressPercentage >= 100 ? 'success' : 'accent'}>
                  {progressPercentage >= 100 ? 'Completed' : progressPercentage > 0 ? 'In Progress' : 'Not Started'}
                </Badge>
                {lesson.audioUrl && <Badge variant="accent">Piper TTS Available</Badge>}
              </div>

              <h1 className="text-h1">{title}</h1>
            </div>

            {/* Quick Mode Jump */}
            <div className="flex gap-2">
              <Link href={`/lessons/${lessonId}/quiz`}>
                <Button variant="outline" size="sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 8 8 12 12 16 12 8" />
                  </svg>
                  <span>Practice Quiz</span>
                </Button>
              </Link>
            </div>
          </header>

          {/* Mobile-Only Progress Bar (Mandated Mobile Layout: Header -> Progress -> Lesson Content) */}
          <div className="block lg:hidden">
            <Card>
              <CardBody>
                <div className="flex justify-between items-center text-small font-medium" style={{ marginBottom: 'var(--spacing-1)' }}>
                  <span>Lesson Completion: {progressPercentage}%</span>
                  <span style={{ color: 'var(--color-primary-700)' }}>
                    Mastery: {masteryScore > 0 ? `${masteryScore}%` : 'Pending'}
                  </span>
                </div>
                <ProgressBar
                  value={progressPercentage}
                  label="Mobile lesson progress"
                  variant={progressPercentage >= 100 ? 'success' : 'primary'}
                />
              </CardBody>
            </Card>
          </div>

          {/* Main Player Two-Column Grid (Desktop) / Fluid Stack (Mobile) */}
          <div className="lesson-player-layout">
            {/* Desktop Left Column: Navigation Sidebar */}
            <div className="hidden lg:block">
              <LessonNavigationSidebar
                activeSection={activeSection}
                onSectionClick={setActiveSection}
                progressPercentage={progressPercentage}
                questionsAnswered={questionsAnswered}
                totalQuestions={totalQuestions}
                masteryScore={masteryScore}
                previousLessonId={previousLessonId}
                nextLessonId={nextLessonId}
                conceptCount={conceptCount}
              />
            </div>

            {/* Right Column: Audio Player + Lesson Content + Concepts + Questions */}
            <main id="main-content" tabIndex={-1} className="lesson-player-main">
              {/* Accessible Cloudinary Audio Player */}
              <AudioPlayer
                audioUrl={lesson.audioUrl}
                waveformUrl={lesson.waveformUrl}
                durationSeconds={lesson.audioDurationSeconds}
                lessonTitle={title}
                lessonId={lessonId}
                metadata={lesson.aiGenerationMetadata}
                onProgressUpdate={updateProgress}
                onSynthesizeAudio={synthesizeAudio}
                isSynthesizing={isAudioGenerating}
              />

              {/* Web Speech API Read-Aloud Assistant */}
              <ReadAloud
                lesson={lesson}
                currentSection={activeSection}
                onSectionSelect={setActiveSection}
              />

              {/* Lesson Core Structured Content */}
              <LessonContent
                lesson={lesson}
                textbook={textbook}
                masteryScores={{}}
              />

              {/* Comprehension Questions */}
              <LessonQuestions
                lessonId={lessonId}
                questions={questions}
                completedCount={questionsAnswered}
              />

              {/* Learning Flow Footer Navigation */}
              <div className="lesson-flow-nav" aria-label="Lesson Flow Controls">
                <div>
                  {previousLessonId ? (
                    <Link href={`/lessons/${previousLessonId}`}>
                      <Button variant="outline" size="md">
                        ← Previous Lesson
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/lessons">
                      <Button variant="outline" size="md">
                        ← Back to Lessons
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/lessons/${lessonId}/quiz`}>
                    <Button variant="primary" size="md">
                      <span>Continue to Quiz Assessment →</span>
                    </Button>
                  </Link>

                  {nextLessonId && (
                    <Link href={`/lessons/${nextLessonId}`}>
                      <Button variant="outline" size="md">
                        Next Lesson →
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
