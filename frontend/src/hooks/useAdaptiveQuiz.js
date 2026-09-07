'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useAdaptiveQuiz(lessonId) {
  const [initialQuestions, setInitialQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timeStartedRef = useRef(Date.now());
  const initialQuestionsRef = useRef([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  /**
   * Fetch initial lesson questions
   */
  const loadQuestions = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/api/lessons/${lessonId}/questions`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw errData.error || new Error(`Failed to load quiz questions (${res.status})`);
      }

      const data = await res.json();
      const rawQuestions = data.data?.questions || [];
      setInitialQuestions(rawQuestions);
      initialQuestionsRef.current = rawQuestions;

      if (rawQuestions.length > 0) {
        setCurrentQuestion(rawQuestions[0]);
        timeStartedRef.current = Date.now();
      } else {
        setIsCompleted(true);
      }
    } catch (err) {
      console.error('[useAdaptiveQuiz] Load questions error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [lessonId, apiUrl]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  /**
   * Submit Answer to Real Backend Endpoint: POST /api/questions/:id/answer
   */
  const submitAnswer = useCallback(async () => {
    if (!currentQuestion || isSubmitting) return;

    if (!studentAnswer || studentAnswer.trim() === '') {
      setError({
        status: 422,
        message: 'Please choose or enter an answer before submitting.'
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const timeTaken = Math.max(1, Math.round((Date.now() - timeStartedRef.current) / 1000));

    try {
      const res = await fetch(`${apiUrl}/api/questions/${currentQuestion.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          studentAnswer: studentAnswer.trim(),
          timeTaken
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const serverError = data.error || {
          status: res.status,
          message: data.message || `Submission failed with HTTP ${res.status}`
        };
        serverError.status = res.status;
        throw serverError;
      }

      const evalData = data.data;
      setEvaluationResult(evalData);

      // Record in local quiz history
      setHistory((prev) => [
        ...prev,
        {
          question: currentQuestion,
          studentAnswer: studentAnswer.trim(),
          isCorrect: evalData.isCorrect,
          score: evalData.score,
          feedback: evalData.feedback,
          timeTaken,
          mastery: evalData.adaptive?.updatedMastery?.masteryScore
        }
      ]);
    } catch (err) {
      console.error('[useAdaptiveQuiz] Answer submission error:', err);
      // Map HTTP status codes cleanly
      const status = err.status || (err.statusCode ? parseInt(err.statusCode, 10) : 500);
      let friendlyMessage = err.message || 'Error communicating with evaluation service.';

      if (status === 401) {
        friendlyMessage = 'Your session has expired. Please log in to continue assessment.';
      } else if (status === 403) {
        friendlyMessage = 'You do not have permission to submit answers for this question.';
      } else if (status === 404) {
        friendlyMessage = 'This question could not be found on the server.';
      } else if (status === 422) {
        friendlyMessage = 'Invalid answer submission. Please check your response format.';
      } else if (status === 429) {
        friendlyMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (status >= 500) {
        friendlyMessage = 'The AI evaluation service encountered a temporary error. You can retry.';
      }

      setError({
        status,
        message: friendlyMessage,
        details: err.details || null
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, isSubmitting, studentAnswer, apiUrl]);

  /**
   * Move to Next Question (Server-Driven Adaptive Selection)
   */
  const nextQuestion = useCallback(() => {
    setError(null);
    setStudentAnswer('');

    const nextQ = evaluationResult?.adaptive?.nextQuestion;
    setEvaluationResult(null);

    // 1. If backend returned an adaptively selected next question:
    if (nextQ && nextQ.id && nextQ.id !== currentQuestion?.id) {
      setCurrentQuestion(nextQ);
      setQuestionIndex((i) => i + 1);
      timeStartedRef.current = Date.now();
      return;
    }

    // 2. Otherwise pick next from initial questions list
    const currentList = initialQuestionsRef.current;
    const currentIndex = currentList.findIndex((q) => q.id === currentQuestion?.id);

    if (currentIndex !== -1 && currentIndex < currentList.length - 1) {
      const nextFromList = currentList[currentIndex + 1];
      setCurrentQuestion(nextFromList);
      setQuestionIndex((i) => i + 1);
      timeStartedRef.current = Date.now();
    } else {
      // All questions completed!
      setIsCompleted(true);
    }
  }, [evaluationResult, currentQuestion]);

  /**
   * Retry answer submission without losing answer state
   */
  const retrySubmission = useCallback(() => {
    submitAnswer();
  }, [submitAnswer]);

  return {
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
    refetchQuestions: loadQuestions
  };
}
