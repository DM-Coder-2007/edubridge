/**
 * EduBridge Adaptive - Frontend API Configuration
 *
 * Backend is Node.js + Express with Snowflake, Cloudinary, Gemini, Piper TTS, and faster-whisper.
 * Frontend communicates ONLY with the Express backend.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',
  HEALTH_DATABASE: '/api/health/database',
  HEALTH_CLOUDINARY: '/api/health/cloudinary',
  HEALTH_AI: '/api/health/ai',
  HEALTH_TTS: '/api/health/tts',
  HEALTH_SPEECH: '/api/health/speech',

  // Auth
  AUTH_SIGNUP: '/api/auth/signup',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_ME: '/api/auth/me',
  AUTH_PREFERENCES: '/api/auth/preferences',

  // Textbooks
  TEXTBOOKS: '/api/textbooks',
  TEXTBOOK_BY_ID: (id) => `/api/textbooks/${id}`,

  // Lessons
  LESSONS: '/api/lessons',
  LESSON_BY_ID: (id) => `/api/lessons/${id}`,
  LESSON_GENERATE: (id) => `/api/lessons/${id}/generate`,
  LESSON_REGENERATE: (id) => `/api/lessons/${id}/regenerate`,
  LESSON_QUESTIONS: (id) => `/api/lessons/${id}/questions`,
  LESSON_AUDIO: (id) => `/api/lessons/${id}/audio`,
  LESSON_MASTERY: (id) => `/api/lessons/${id}/mastery`,

  // Questions & Answers
  QUESTION_BY_ID: (id) => `/api/questions/${id}`,
  QUESTION_ANSWER: (id) => `/api/questions/${id}/answer`,

  // Concepts & Mastery
  CONCEPT_BY_ID: (id) => `/api/concepts/${id}`,
  CONCEPT_MASTERY: (id) => `/api/concepts/${id}/mastery`,

  // Speech Recognition (faster-whisper)
  SPEECH_TRANSCRIBE: '/api/speech/transcribe',

  // Dashboard & Progress
  DASHBOARD: '/api/dashboard',
  DASHBOARD_PROGRESS: '/api/dashboard/progress',
  DASHBOARD_MASTERY: '/api/dashboard/mastery',

  // Media
  MEDIA_TEXTBOOK: '/api/media/textbook',
  MEDIA_AUDIO: '/api/media/audio',
  MEDIA_TRANSFORM: '/api/media/accessible-transform'
};
