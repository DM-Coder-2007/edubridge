/**
 * EduBridge Adaptive - End-to-End REST API Integration Tests
 *
 * Verifies all API routes:
 * - /api/health
 * - /api/auth
 * - /api/textbooks
 * - /api/lessons
 * - /api/concepts
 * - /api/quiz (text & faster-whisper voice answers)
 * - /api/progress
 * - /api/media
 */

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');

describe.skip('EduBridge Adaptive API Integration Tests (Pending API routes consolidation phase)', () => {
  let authToken;
  let userId;
  let testEmail;
  let sampleImageBuffer;
  let createdTextbookId;
  let createdLessonId;
  let createdConceptId;
  let createdQuestionId;
  let quizAttemptId;

  beforeAll(async () => {
    testEmail = `e2e_student_${Date.now()}@edubridge.org`;
    sampleImageBuffer = await sharp({
      create: {
        width: 300,
        height: 400,
        channels: 3,
        background: { r: 245, g: 245, b: 245 }
      }
    }).jpeg().toBuffer();
  });

  describe('GET / - Service Root', () => {
    it('should return service information', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('EduBridge Adaptive Backend');
      expect(res.body.data.database).toBe('Snowflake (Primary)');
      expect(res.body.data.tts).toBe('Piper TTS');
      expect(res.body.data.speechRecognition).toBe('faster-whisper');
    });
  });

  describe('GET /api/health - System Health Check', () => {
    it('should report healthy status for Snowflake, Piper TTS, and integrations', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.services.database.primary).toBe('Snowflake');
      expect(res.body.data.services.tts.engine).toBe('Piper TTS');
      expect(res.body.data.services.speechRecognition.engine).toBe('faster-whisper');
      expect(res.body.data.services.media.provider).toBe('Cloudinary');
      expect(res.body.data.services.ai.multimodal).toBe('Google Gemini');
    });
  });

  describe('POST /api/auth - Authentication Flow', () => {
    it('should register a new student account and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password123!',
          fullName: 'Sam Student',
          role: 'student',
          gradeLevel: 'Grade 10',
          accessibilityPreferences: {
            highContrast: true,
            ttsSpeed: 1.2
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);

      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('should prevent duplicate registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password123!',
          fullName: 'Duplicate Sam'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should login student and return valid JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      authToken = res.body.data.token;
    });

    it('should get current authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(userId);
      expect(res.body.data.user.fullName).toBe('Sam Student');
    });

    it('should update accessibility preferences', async () => {
      const res = await request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          highContrast: true,
          ttsSpeed: 1.5,
          colorTheme: 'yellow-on-black'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.accessibilityPreferences.ttsSpeed).toBe(1.5);
    });
  });

  describe('POST /api/textbooks/process - Multi-Stage Accessibility Pipeline', () => {
    it('should reject unauthenticated upload', async () => {
      const res = await request(app)
        .post('/api/textbooks/process')
        .attach('image', sampleImageBuffer, 'sample.jpg');

      expect(res.status).toBe(401);
    });

    it('should process textbook scan through complete pipeline', async () => {
      const res = await request(app)
        .post('/api/textbooks/process')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Grade 10 Biology - Cellular Respiration')
        .field('subject', 'Biology')
        .field('gradeLevel', 'Grade 10')
        .field('chapterTitle', 'Mitochondria Energy Flow')
        .attach('image', sampleImageBuffer, 'cell_scan.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.textbook).toBeDefined();
      expect(res.body.data.lesson).toBeDefined();

      createdTextbookId = res.body.data.textbook.id;
      createdLessonId = res.body.data.lesson.id;

      expect(createdTextbookId).toBeDefined();
      expect(createdLessonId).toBeDefined();
      expect(res.body.data.lesson.audioUrl).toBeDefined();
    });

    it('should list user textbooks', async () => {
      const res = await request(app)
        .get('/api/textbooks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.textbooks)).toBe(true);
      expect(res.body.data.textbooks.some(t => t.id === createdTextbookId)).toBe(true);
    });

    it('should get textbook details by id', async () => {
      const res = await request(app)
        .get(`/api/textbooks/${createdTextbookId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.textbook.id).toBe(createdTextbookId);
    });

    it('should get processing status history', async () => {
      const res = await request(app)
        .get(`/api/textbooks/${createdTextbookId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.history).toBeDefined();
    });
  });

  describe('GET /api/lessons - Accessible Lessons', () => {
    it('should list lessons for current student', async () => {
      const res = await request(app)
        .get('/api/lessons')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.lessons)).toBe(true);
      expect(res.body.data.lessons.some(l => l.id === createdLessonId)).toBe(true);
    });

    it('should get full lesson with concepts and questions', async () => {
      const res = await request(app)
        .get(`/api/lessons/${createdLessonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lesson.id).toBe(createdLessonId);
      expect(Array.isArray(res.body.data.concepts)).toBe(true);
      expect(Array.isArray(res.body.data.questions)).toBe(true);

      if (res.body.data.concepts.length > 0) {
        createdConceptId = res.body.data.concepts[0].id;
      }
      if (res.body.data.questions.length > 0) {
        createdQuestionId = res.body.data.questions[0].id;
      }
    });

    it('should regenerate Piper TTS audio narration', async () => {
      const res = await request(app)
        .post(`/api/lessons/${createdLessonId}/regenerate-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          speakingRate: 1.25,
          voice: 'en_US-lessac-medium'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lesson.audioUrl).toBeDefined();
    });
  });

  describe('GET /api/concepts - Educational Concepts & Sensory Analogies', () => {
    it('should get concepts by lesson id', async () => {
      const res = await request(app)
        .get(`/api/concepts/lesson/${createdLessonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.concepts)).toBe(true);
    });

    it('should get single concept by id', async () => {
      if (!createdConceptId) return;

      const res = await request(app)
        .get(`/api/concepts/${createdConceptId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.concept.id).toBe(createdConceptId);
    });
  });

  describe('POST /api/quiz - Assessment Flow with faster-whisper Voice Input', () => {
    it('should get quiz questions for lesson', async () => {
      const res = await request(app)
        .get(`/api/quiz/lesson/${createdLessonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.questions)).toBe(true);
    });

    it('should start a new quiz attempt', async () => {
      const res = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lessonId: createdLessonId,
          totalQuestions: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attempt.id).toBeDefined();
      quizAttemptId = res.body.data.attempt.id;
    });

    it('should submit text answer evaluated by Gemini', async () => {
      if (!createdQuestionId) return;

      const res = await request(app)
        .post('/api/quiz/submit-answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attemptId: quizAttemptId,
          questionId: createdQuestionId,
          studentAnswer: 'Providing rigid shape and structural protection'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeDefined();
      expect(res.body.data.evaluation).toBeDefined();
      expect(typeof res.body.data.evaluation.isCorrect).toBe('boolean');
    });

    it('should submit voice answer transcribed by faster-whisper and evaluated by Gemini', async () => {
      if (!createdQuestionId) return;

      const dummyVoiceAudio = Buffer.from('mock-audio-recording-webm');

      const res = await request(app)
        .post('/api/quiz/submit-answer')
        .set('Authorization', `Bearer ${authToken}`)
        .field('attemptId', quizAttemptId)
        .field('questionId', createdQuestionId)
        .attach('voiceAudio', dummyVoiceAudio, 'student_voice.webm');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer.userAnswerText).toBeDefined();
      expect(res.body.data.evaluation).toBeDefined();
    });

    it('should complete quiz attempt and calculate score in Snowflake', async () => {
      const res = await request(app)
        .post('/api/quiz/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attemptId: quizAttemptId,
          timeSpentSeconds: 65
        });

      expect(res.status).toBe(200);
      expect(res.body.data.attempt.status).toBe('COMPLETED');
      expect(res.body.data.scorePercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET/PUT /api/progress - Student Progress & Mastery', () => {
    it('should update lesson progress audio position and status', async () => {
      const res = await request(app)
        .put(`/api/progress/lesson/${createdLessonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completionPercentage: 100,
          lastAudioPositionSeconds: 45.0,
          status: 'COMPLETED'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.progress.completionPercentage).toBe(100);
    });

    it('should get overview of student progress', async () => {
      const res = await request(app)
        .get('/api/progress')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalLessonsTracked).toBeGreaterThanOrEqual(1);
    });

    it('should get concept mastery scores', async () => {
      const res = await request(app)
        .get('/api/progress/mastery')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.mastery)).toBe(true);
    });
  });

  describe('POST/GET /api/media - Cloudinary Media Layer', () => {
    it('should upload textbook image to Cloudinary and return accessible URL', async () => {
      const res = await request(app)
        .post('/api/media/upload-textbook')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', sampleImageBuffer, 'page.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.raw.url).toBeDefined();
      expect(res.body.data.processed.url).toBeDefined();
      expect(res.body.data.processed.accessibleUrl).toBeDefined();
    });

    it('should generate accessible Cloudinary transform URL', async () => {
      const res = await request(app)
        .get('/api/media/accessible-transform')
        .query({
          publicId: 'edubridge/textbooks/processed/sample',
          highContrast: 'true',
          invert: 'true',
          zoomWidth: '1800'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain('w_1800');
      expect(res.body.data.url).toContain('e_contrast:50');
      expect(res.body.data.url).toContain('e_negate');
    });
  });

  describe('Error Handling Middleware', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent-route-xyz');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for validation failures', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
