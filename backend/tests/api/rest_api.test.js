/**
 * EduBridge Adaptive - Comprehensive REST API Test Suite
 *
 * Verifies all mandated endpoints:
 * 1. AUTH:
 *    - POST /api/auth/signup
 *    - POST /api/auth/login
 *    - POST /api/auth/logout
 *    - GET  /api/auth/me
 * 2. TEXTBOOK:
 *    - POST   /api/textbooks
 *    - GET    /api/textbooks
 *    - GET    /api/textbooks/:id
 *    - DELETE /api/textbooks/:id
 * 3. LESSONS:
 *    - GET  /api/lessons/:id
 *    - POST /api/lessons/:id/generate
 *    - POST /api/lessons/:id/regenerate
 * 4. QUESTIONS:
 *    - GET  /api/lessons/:id/questions
 *    - GET  /api/questions/:id
 * 5. ANSWERS:
 *    - POST /api/questions/:id/answer (text & audio recording)
 * 6. ADAPTIVE:
 *    - GET /api/lessons/:id/mastery
 *    - GET /api/concepts/:id/mastery
 * 7. AUDIO:
 *    - POST /api/lessons/:id/audio
 *    - GET  /api/lessons/:id/audio
 * 8. SPEECH:
 *    - POST /api/speech/transcribe
 * 9. DASHBOARD:
 *    - GET /api/dashboard
 *    - GET /api/dashboard/progress
 *    - GET /api/dashboard/mastery
 * 10. HEALTH:
 *    - GET /api/health
 *    - GET /api/health/database
 *    - GET /api/health/cloudinary
 *    - GET /api/health/ai
 *    - GET /api/health/tts
 *    - GET /api/health/speech
 * 11. SECURITY & VALIDATION:
 *    - Authentication enforcement (401)
 *    - Authorization & User isolation (403)
 *    - Input validation (400)
 *    - Missing resource handling (404)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_edubridge_adaptive_auth_verification_key_32bytes';
process.env.WHISPER_MOCK_FALLBACK = 'true';
process.env.GEMINI_MOCK_FALLBACK = 'true';
process.env.CLOUDINARY_MOCK_FALLBACK = 'true';
process.env.PIPER_MOCK_FALLBACK = 'true';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const databaseManager = require('../../src/database/snowflake/databaseManager');
const {
  userRepository,
  lessonRepository,
  questionRepository,
  conceptRepository
} = require('../../src/repositories');

// Helper to create valid WAV buffer for speech tests
function createTestWavBuffer(tag = 'voice-recording-sample') {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = 512;
  const fileSize = 44 + dataSize;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(fileSize - 8, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wavHeader.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const pcmData = Buffer.alloc(dataSize, 0x44);
  pcmData.write(tag, 0);

  return Buffer.concat([wavHeader, pcmData]);
}

describe('EduBridge Adaptive Complete REST API Test Suite', () => {
  const timestamp = Date.now();
  let studentCookie = null;
  let studentId = null;
  let secondaryStudentCookie = null;
  let secondaryStudentId = null;

  let testTextbookId = null;
  let testLessonId = null;
  let testConceptId = null;
  let testQuestionId = null;

  let sampleImageBuffer;
  let sampleWavBuffer;

  beforeAll(async () => {
    // Initialize Snowflake schema
    await databaseManager.initializeDatabase();

    // Generate valid JPEG in memory
    sampleImageBuffer = await sharp({
      create: {
        width: 300,
        height: 400,
        channels: 3,
        background: { r: 240, g: 240, b: 240 }
      }
    })
      .jpeg()
      .toBuffer();

    sampleWavBuffer = createTestWavBuffer('student-voice-response');
  });

  // ==========================================================================
  // 1. HEALTH CHECKS
  // ==========================================================================
  describe('1. Health Check Endpoints', () => {
    it('GET /api/health should return root operational status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
    });

    it('GET /api/health/database should report Snowflake primary status', async () => {
      const res = await request(app).get('/api/health/database');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.primary).toBe('Snowflake');
      expect(res.body.data.snowflake.status).toBe('healthy');
    });

    it('GET /api/health/cloudinary should report Cloudinary media status', async () => {
      const res = await request(app).get('/api/health/cloudinary');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.healthy).toBe(true);
      expect(res.body.data.provider).toBe('Cloudinary');
    });

    it('GET /api/health/ai should report Gemini multimodal status', async () => {
      const res = await request(app).get('/api/health/ai');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('Google Gemini');
      expect(res.body.data.status).toBe('healthy');
    });

    it('GET /api/health/tts should report Piper TTS engine status', async () => {
      const res = await request(app).get('/api/health/tts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.engine).toBe('Piper TTS');
    });

    it('GET /api/health/speech should report faster-whisper speech recognition status', async () => {
      const res = await request(app).get('/api/health/speech');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.engine).toBe('faster-whisper');
    });
  });

  // ==========================================================================
  // 2. AUTHENTICATION & SESSIONS
  // ==========================================================================
  describe('2. Authentication Endpoints', () => {
    it('POST /api/auth/signup should register a student and set HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `primary_student_${timestamp}@edubridge.org`,
          password: 'Password123!',
          fullName: 'Primary Student',
          role: 'student',
          gradeLevel: 'Grade 9',
          preferredLanguage: 'en'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(`primary_student_${timestamp}@edubridge.org`);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      studentId = res.body.data.user.id;
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      studentCookie = setCookie;
    });

    it('POST /api/auth/signup should register secondary student for isolation tests', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `secondary_student_${timestamp}@edubridge.org`,
          password: 'Password123!',
          fullName: 'Secondary Student',
          role: 'student',
          gradeLevel: 'Grade 10'
        });

      expect(res.status).toBe(201);
      secondaryStudentId = res.body.data.user.id;
      secondaryStudentCookie = res.headers['set-cookie'];
    });

    it('POST /api/auth/login should authenticate student and issue fresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `primary_student_${timestamp}@edubridge.org`,
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentId);
      studentCookie = res.headers['set-cookie'];
    });

    it('GET /api/auth/me should return current authenticated student profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentId);
      expect(res.body.data.user.fullName).toBe('Primary Student');
    });

    it('GET /api/auth/me should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/logout should clear session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const setCookie = res.headers['set-cookie'][0];
      expect(setCookie).toMatch(/(token=|auth_token=);/);
    });
  });

  // ==========================================================================
  // 3. TEXTBOOK PIPELINE
  // ==========================================================================
  describe('3. Textbook Endpoints', () => {
    beforeAll(async () => {
      // Re-login after logout test to establish active session for remaining resources
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `primary_student_${timestamp}@edubridge.org`,
          password: 'Password123!'
        });
      studentCookie = res.headers['set-cookie'];
    });

    it('POST /api/textbooks should reject creation without title', async () => {
      const res = await request(app)
        .post('/api/textbooks')
        .set('Cookie', studentCookie)
        .send({ subject: 'Physics' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/textbooks should upload textbook scan and process OCR pipeline', async () => {
      const res = await request(app)
        .post('/api/textbooks')
        .set('Cookie', studentCookie)
        .field('title', 'Chapter 3: Thermodynamics')
        .field('subject', 'Physics')
        .field('gradeLevel', 'Grade 9')
        .attach('image', sampleImageBuffer, 'sample_page.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.textbook).toBeDefined();
      expect(res.body.data.textbook.title).toBe('Chapter 3: Thermodynamics');

      testTextbookId = res.body.data.textbook.id;
    });

    it('GET /api/textbooks should list authenticated user\'s textbooks', async () => {
      const res = await request(app)
        .get('/api/textbooks')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.textbooks)).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/textbooks/:id should retrieve single textbook details', async () => {
      const res = await request(app)
        .get(`/api/textbooks/${testTextbookId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.textbook.id).toBe(testTextbookId);
    });

    it('GET /api/textbooks/:id should enforce user isolation (403 for other student)', async () => {
      const res = await request(app)
        .get(`/api/textbooks/${testTextbookId}`)
        .set('Cookie', secondaryStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('DELETE /api/textbooks/:id should reject foreign student attempt (403)', async () => {
      const res = await request(app)
        .delete(`/api/textbooks/${testTextbookId}`)
        .set('Cookie', secondaryStudentCookie);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // 4. LESSON GENERATION & ADAPTATIONS
  // ==========================================================================
  describe('4. Lesson Endpoints', () => {
    beforeAll(async () => {
      // Seed a test lesson for the primary student
      const lesson = await lessonRepository.create({
        textbookAssetId: testTextbookId,
        userId: studentId,
        title: 'Thermodynamics Fundamentals',
        summary: 'Heat energy transfers from hotter to colder regions.',
        simplifiedText: 'Heat is energy moving from warm objects to cold objects.',
        screenReaderTranscript: 'Detailed audio transcript explaining thermal energy.',
        sensoryAnalogies: ['Like feeling the warmth of a mug against cold hands.'],
        keyTakeaways: ['Heat flows from hot to cold', 'Energy is conserved'],
        difficultyLevel: 'beginner'
      });
      testLessonId = lesson.id;

      // Seed a concept and questions
      const concept = await conceptRepository.create({
        lessonId: testLessonId,
        name: 'Heat Transfer',
        explanation: 'The flow of thermal energy between substances.',
        simplifiedAnalogy: 'Holding a warm mug on a chilly day.',
        difficultyLevel: 'medium'
      });
      testConceptId = concept.id;

      const question = await questionRepository.create({
        lessonId: testLessonId,
        conceptId: testConceptId,
        questionText: 'In which direction does thermal heat naturally flow?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['From hotter to cooler objects', 'From cooler to hotter objects'],
        correctAnswer: 'From hotter to cooler objects',
        explanation: 'Heat always transfers spontaneously from areas of higher temperature to lower temperature.',
        difficultyLevel: 'medium'
      });
      testQuestionId = question.id;
    });

    it('GET /api/lessons/:id should retrieve lesson with content and audio pointers', async () => {
      const res = await request(app)
        .get(`/api/lessons/${testLessonId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lesson.id).toBe(testLessonId);
      expect(res.body.data.lesson.title).toBe('Thermodynamics Fundamentals');
    });

    it('GET /api/lessons/:id should return 404 for non-existent lesson', async () => {
      const res = await request(app)
        .get('/api/lessons/non_existent_lesson_999')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/lessons/:id/generate should synthesize accessible lesson using Gemini', async () => {
      const genId = `gen_lesson_${Date.now()}`;
      const res = await request(app)
        .post(`/api/lessons/${genId}/generate`)
        .set('Cookie', studentCookie)
        .send({
          title: 'Photosynthesis in Plants',
          subject: 'Biology',
          rawText: 'Chlorophyll absorbs sunlight to synthesize glucose from carbon dioxide and water.',
          generateQuestions: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lesson).toBeDefined();
      expect(res.body.data.lesson.id).toBe(genId);
    });

    it('POST /api/lessons/:id/regenerate should create cognitive adaptation with simpler analogies', async () => {
      const res = await request(app)
        .post(`/api/lessons/${testLessonId}/regenerate`)
        .set('Cookie', studentCookie)
        .send({
          targetDifficulty: 'easy',
          simplerExplanation: true,
          strugglingConcept: 'Heat Transfer'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lesson).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. QUESTIONS & ANSWERS (ADAPTIVE EVALUATION)
  // ==========================================================================
  describe('5. Questions & Answers Endpoints', () => {
    it('GET /api/lessons/:id/questions should retrieve questions for the lesson', async () => {
      const res = await request(app)
        .get(`/api/lessons/${testLessonId}/questions`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.questions)).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/questions/:id should retrieve single question details', async () => {
      const res = await request(app)
        .get(`/api/questions/${testQuestionId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question.id).toBe(testQuestionId);
      expect(res.body.data.question.questionText).toContain('thermal heat naturally flow');
    });

    it('GET /api/questions/:id should return 404 for invalid question ID', async () => {
      const res = await request(app)
        .get('/api/questions/invalid_q_id_000')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/questions/:id/answer should reject empty answer submission', async () => {
      const res = await request(app)
        .post(`/api/questions/${testQuestionId}/answer`)
        .set('Cookie', studentCookie)
        .send({ studentAnswer: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/questions/:id/answer should evaluate typed text answer and update mastery', async () => {
      const res = await request(app)
        .post(`/api/questions/${testQuestionId}/answer`)
        .set('Cookie', studentCookie)
        .send({
          studentAnswer: 'Heat naturally flows from hotter objects to cooler ones.',
          timeTaken: 15
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.questionId).toBe(testQuestionId);
      expect(typeof res.body.data.isCorrect).toBe('boolean');
      expect(res.body.data.feedback).toBeDefined();
      expect(res.body.data.adaptive).toBeDefined();
      expect(res.body.data.adaptive.updatedMastery).toBeDefined();
    });

    it('POST /api/questions/:id/answer should support voice answer audio upload (faster-whisper)', async () => {
      const res = await request(app)
        .post(`/api/questions/${testQuestionId}/answer`)
        .set('Cookie', studentCookie)
        .attach('audio', sampleWavBuffer, 'voice_answer.wav')
        .field('timeTaken', '12');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isVoiceAnswer).toBe(true);
      expect(res.body.data.voiceTranscript).toBeDefined();
      expect(res.body.data.feedback).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. ADAPTIVE MASTERY
  // ==========================================================================
  describe('6. Adaptive Learning Mastery Endpoints', () => {
    it('GET /api/lessons/:id/mastery should return aggregate lesson mastery', async () => {
      const res = await request(app)
        .get(`/api/lessons/${testLessonId}/mastery`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lessonId).toBe(testLessonId);
      expect(typeof res.body.data.overallMasteryScore).toBe('number');
    });

    it('GET /api/concepts/:id/mastery should return concept mastery progression', async () => {
      const res = await request(app)
        .get(`/api/concepts/${testConceptId}/mastery`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mastery).toBeDefined();
      expect(res.body.data.mastery.conceptId).toBe(testConceptId);
    });
  });

  // ==========================================================================
  // 7. AUDIO (PIPER TTS + CLOUDINARY)
  // ==========================================================================
  describe('7. Lesson Audio Endpoints', () => {
    it('POST /api/lessons/:id/audio should synthesize Piper narration and upload to Cloudinary', async () => {
      const res = await request(app)
        .post(`/api/lessons/${testLessonId}/audio`)
        .set('Cookie', studentCookie)
        .send({
          voice: 'en_US-lessac-medium',
          speed: 1.1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.audioUrl).toBeDefined();
      expect(res.body.data.waveformUrl).toBeDefined();
      expect(res.body.data.lessonId).toBe(testLessonId);
    });

    it('GET /api/lessons/:id/audio should retrieve audio metadata and waveform', async () => {
      const res = await request(app)
        .get(`/api/lessons/${testLessonId}/audio`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lessonId).toBe(testLessonId);
      expect(res.body.data.audioUrl).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. SPEECH TRANSCRIPTION (FASTER-WHISPER)
  // ==========================================================================
  describe('8. Speech Recognition Endpoints', () => {
    it('POST /api/speech/transcribe should reject missing audio', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Cookie', studentCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/speech/transcribe should transcribe audio buffer via faster-whisper', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Cookie', studentCookie)
        .attach('audio', sampleWavBuffer, 'speech_test.wav')
        .field('language', 'en');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBeDefined();
      expect(res.body.data.confidence).toBeGreaterThan(0);
      expect(res.body.data.language).toBe('en');
    });
  });

  // ==========================================================================
  // 9. DASHBOARD
  // ==========================================================================
  describe('9. Dashboard Analytics Endpoints', () => {
    it('GET /api/dashboard should return high-level summary overview', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.id).toBe(studentId);
      expect(res.body.data.overview.totalLessons).toBeGreaterThanOrEqual(1);
      expect(res.body.data.recentActivity).toBeDefined();
    });

    it('GET /api/dashboard/progress should return detailed reading and audio progress', async () => {
      const res = await request(app)
        .get('/api/dashboard/progress')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(Array.isArray(res.body.data.lessons)).toBe(true);
    });

    it('GET /api/dashboard/mastery should return concept mastery distribution & weak spots', async () => {
      const res = await request(app)
        .get('/api/dashboard/mastery')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.analytics).toBeDefined();
      expect(res.body.data.breakdown).toBeDefined();
      expect(Array.isArray(res.body.data.recommendedReinforcement)).toBe(true);
    });
  });

  // ==========================================================================
  // 10. CLEANUP (DELETE TEXTBOOK)
  // ==========================================================================
  describe('10. Textbook Deletion', () => {
    it('DELETE /api/textbooks/:id should allow owner to delete textbook', async () => {
      const res = await request(app)
        .delete(`/api/textbooks/${testTextbookId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testTextbookId);
    });
  });
});
