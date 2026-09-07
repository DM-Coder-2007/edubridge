'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '../../../../components/shell';
import { ProtectedRoute } from '../../../../components/auth';
import {
  Card,
  CardBody,
  Button,
  Badge,
  ProgressBar,
  Spinner,
  ErrorState,
  EmptyState,
  InlineError
} from '../../../../components/ui';

import { useAdaptiveQuiz } from '../../../../hooks/useAdaptiveQuiz';
import { QuestionInput, EvaluationResult, QuizSummary } from '../../../../components/quiz';

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params?.lessonId;

  const [lessonTitle, setLessonTitle] = useState('Lesson Assessment');

  const {
    currentQuestion,
    questionIndex,
    studentAnswer,
    setStudentAnswer,
    isSubmitting,
    evaluationResult,
    history,
    isCompleted,
    loading,
    error,
    submitAnswer,
    nextQuestion,
    retrySubmission,
    refetchQuestions
  } = useAdaptiveQuiz(lessonId);

  // Fetch lesson title for breadcrumbs and header
  useEffect(() => {
    if (!lessonId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    let isMounted = true;

    fetch(`${apiUrl}/api/lessons/${lessonId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.data?.lesson?.title) {
          setLessonTitle(data.data.lesson.title);
        }
      })
      .catch(() => {
        // Non-fatal, fallback to default title
      });

    return () => {
      isMounted = false;
    };
  }, [lessonId]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Lessons', href: '/lessons' },
    { label: lessonTitle, href: `/lessons/${lessonId}` },
    { label: 'Quiz' }
  ];

  const difficultyVariant = (level) => {
    switch (String(level).toLowerCase()) {
      case 'easy':
        return 'success';
      case 'hard':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <ProtectedRoute>
      <PageContainer breadcrumbs={breadcrumbs}>
        <div className="quiz-container">
          {/* Header Navigation & Title */}
          <div className="quiz-header">
            <div>
              <Link
                href={`/lessons/${lessonId}`}
                className="btn btn--secondary btn--sm"
                style={{ marginBottom: 'var(--spacing-2)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ← Back to Lesson
              </Link>
              <h1 className="h2" style={{ margin: 0 }}>
                Comprehension Assessment
              </h1>
              <p className="text-secondary" style={{ marginTop: 'var(--spacing-1)' }}>
                {lessonTitle}
              </p>
            </div>

            {!isCompleted && currentQuestion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <Badge variant={difficultyVariant(currentQuestion.difficultyLevel || 'medium')}>
                  {(currentQuestion.difficultyLevel || 'medium').toUpperCase()}
                </Badge>
                <Badge variant="neutral">
                  Question {questionIndex}
                </Badge>
              </div>
            )}
          </div>

          {/* Initial Loading State */}
          {loading && (
            <Card>
              <CardBody>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-12) 0',
                    gap: 'var(--spacing-4)'
                  }}
                  role="status"
                  aria-busy="true"
                  aria-label="Loading adaptive assessment questions"
                >
                  <Spinner size="lg" />
                  <p className="text-secondary">Loading adaptive assessment questions from Snowflake...</p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Initial Error State (e.g. Failed to load questions) */}
          {!loading && error && !currentQuestion && !isCompleted && (
            <ErrorState
              error={error}
              title="Assessment Unavailable"
              onRetry={refetchQuestions}
              retryText="Try Loading Again"
              secondaryAction={
                <Link href={`/lessons/${lessonId}`}>
                  <Button variant="outline">Back to Lesson</Button>
                </Link>
              }
            />
          )}

          {/* Zero Questions Empty State */}
          {!loading && !error && !currentQuestion && !isCompleted && (
            <EmptyState
              title="No Questions Available"
              description="No assessment questions have been generated for this lesson yet. Review the core lesson content or try refreshing."
              action={
                <Link href={`/lessons/${lessonId}`}>
                  <Button variant="primary">Back to Lesson</Button>
                </Link>
              }
              secondaryAction={
                <Button variant="outline" onClick={refetchQuestions}>
                  Refresh Questions
                </Button>
              }
            />
          )}

          {/* Completed State: Quiz Summary */}
          {!loading && isCompleted && (
            <QuizSummary
              lessonId={lessonId}
              history={history}
              onRetake={() => {
                refetchQuestions();
              }}
            />
          )}

          {/* Active Question Assessment Experience */}
          {!loading && !isCompleted && currentQuestion && (
            <div className="stack-lg">
              {/* Submission Error Alert using InlineError */}
              {error && (
                <InlineError
                  error={error}
                  onRetry={retrySubmission}
                />
              )}


              {/* Question Card */}
              <div className="quiz-question-card">
                {/* Audio prompt hint if available */}
                {currentQuestion.audioPromptHint && (
                  <div className="quiz-hint-banner" role="note">
                    <span aria-hidden="true">💡</span>
                    <span><strong>Audio Hint:</strong> {currentQuestion.audioPromptHint}</span>
                  </div>
                )}

                {/* Question Prompt */}
                <h2 className="quiz-question-text" id="question-prompt">
                  {currentQuestion.questionText}
                </h2>

                {/* Interactive Input Form */}
                <QuestionInput
                  question={currentQuestion}
                  studentAnswer={studentAnswer}
                  onAnswerChange={setStudentAnswer}
                  disabled={isSubmitting || Boolean(evaluationResult)}
                />

                {/* Submit Action (Before evaluation) */}
                {!evaluationResult && (
                  <div className="quiz-actions-bar" style={{ marginTop: 'var(--spacing-4)' }}>
                    <p className="text-secondary" style={{ fontSize: 'var(--font-size-small)' }}>
                      Select or type your response and submit for real-time AI evaluation.
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={submitAnswer}
                      isLoading={isSubmitting}
                      disabled={isSubmitting || !studentAnswer || studentAnswer.trim().length === 0}
                    >
                      Submit Answer
                    </Button>
                  </div>
                )}
              </div>

              {/* Real-time Evaluation Result & Adaptive Feedback Panel */}
              {evaluationResult && (
                <div className="stack-lg" role="region" aria-live="polite" aria-label="Evaluation Feedback">
                  <EvaluationResult
                    result={evaluationResult}
                    question={currentQuestion}
                  />

                  {/* Next Step Action */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 'var(--spacing-3)',
                      padding: 'var(--spacing-4) 0'
                    }}
                  >
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={nextQuestion}
                    >
                      Continue to Next Question →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
