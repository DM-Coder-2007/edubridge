/**
 * EduBridge Adaptive - Repository Abstractions Test Suite
 *
 * Verifies that database access is strictly isolated in dedicated repository classes
 * mapping directly to the primary Snowflake data layer:
 * - user.repository.js
 * - lesson.repository.js
 * - question.repository.js
 * - attempt.repository.js
 * - mastery.repository.js
 * - media.repository.js
 * - audio.repository.js
 */

process.env.NODE_ENV = 'test';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const {
  userRepository,
  lessonRepository,
  questionRepository,
  attemptRepository,
  masteryRepository,
  mediaRepository,
  audioRepository
} = require('../../src/repositories');

describe('Repository Abstractions: Snowflake Data Layer', () => {
  const timestamp = Date.now();
  let createdUser = null;
  let createdMedia = null;
  let createdLesson = null;
  let createdQuestion = null;
  let createdAttempt = null;

  // ==========================================================================
  // 1. user.repository.js
  // ==========================================================================
  describe('1. user.repository.js', () => {
    it('should create and retrieve a user in Snowflake', async () => {
      const email = `repo_user_${timestamp}@edubridge.org`;
      createdUser = await userRepository.create({
        email,
        passwordHash: '$2a$10$hashedPasswordSample1234567890',
        fullName: 'Taylor Student',
        role: 'student',
        gradeLevel: 'Grade 11',
        preferredLanguage: 'en',
        accessibilityPreferences: { highContrast: true, voiceSpeed: 1.25 }
      });

      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe(email);
      expect(createdUser.fullName).toBe('Taylor Student');
      expect(createdUser.role).toBe('student');
      expect(createdUser.isActive).toBe(true);
      expect(createdUser.accessibilityPreferences.highContrast).toBe(true);
      expect(createdUser.accessibilityPreferences.voiceSpeed).toBe(1.25);

      // findByEmail
      const foundByEmail = await userRepository.findByEmail(email);
      expect(foundByEmail).not.toBeNull();
      expect(foundByEmail.id).toBe(createdUser.id);

      // findById
      const foundById = await userRepository.findById(createdUser.id);
      expect(foundById).not.toBeNull();
      expect(foundById.email).toBe(email);
    });

    it('should update user accessibility preferences and profile fields', async () => {
      const updatedPrefs = await userRepository.updatePreferences(createdUser.id, {
        highContrast: false,
        voiceSpeed: 1.5,
        tactileDiagrams: true
      });
      expect(updatedPrefs.accessibilityPreferences.highContrast).toBe(false);
      expect(updatedPrefs.accessibilityPreferences.voiceSpeed).toBe(1.5);
      expect(updatedPrefs.accessibilityPreferences.tactileDiagrams).toBe(true);

      const updatedProfile = await userRepository.updateProfile(createdUser.id, {
        fullName: 'Taylor M. Student',
        gradeLevel: 'Grade 12'
      });
      expect(updatedProfile.fullName).toBe('Taylor M. Student');
      expect(updatedProfile.gradeLevel).toBe('Grade 12');
    });

    it('should update user active status', async () => {
      const deactivated = await userRepository.updateStatus(createdUser.id, false);
      expect(deactivated.isActive).toBe(false);

      const reactivated = await userRepository.updateStatus(createdUser.id, true);
      expect(reactivated.isActive).toBe(true);
    });
  });

  // ==========================================================================
  // 2. media.repository.js
  // ==========================================================================
  describe('2. media.repository.js', () => {
    it('should create and retrieve a textbook media asset in Snowflake', async () => {
      createdMedia = await mediaRepository.create({
        userId: createdUser.id,
        title: 'Biology Chapter 4 - Cellular Respiration',
        subject: 'Biology',
        gradeLevel: 'Grade 10',
        chapterTitle: 'Cellular Respiration',
        rawImageUrl: 'https://res.cloudinary.com/edubridge/image/upload/v1/biology_scan.jpg',
        rawImagePublicId: 'edubridge/textbooks/raw/biology_scan_01',
        metadata: { originalWidth: 2400, originalHeight: 3200 }
      });

      expect(createdMedia).toBeDefined();
      expect(createdMedia.id).toBeDefined();
      expect(createdMedia.userId).toBe(createdUser.id);
      expect(createdMedia.title).toContain('Cellular Respiration');
      expect(createdMedia.processingStatus).toBe('PENDING');

      // findById
      const found = await mediaRepository.findById(createdMedia.id);
      expect(found).not.toBeNull();
      expect(found.rawImagePublicId).toBe('edubridge/textbooks/raw/biology_scan_01');

      // findByUserId
      const userAssets = await mediaRepository.findByUserId(createdUser.id);
      expect(userAssets.length).toBeGreaterThanOrEqual(1);
    });

    it('should update pipeline processing status and OCR results', async () => {
      const updatedStatus = await mediaRepository.updateStatus(createdMedia.id, {
        status: 'OCR_PROCESSING',
        retryCount: 1,
        startedAt: new Date().toISOString()
      });
      expect(updatedStatus.processingStatus).toBe('OCR_PROCESSING');
      expect(updatedStatus.retryCount).toBe(1);

      const updatedOcr = await mediaRepository.updateOcrResult(createdMedia.id, {
        ocrExtractedText: 'Mitochondria is the powerhouse of the cell generating ATP.',
        diagramDescriptions: [{ id: 'fig-1', description: 'Cross section of a mitochondrion showing inner cristae.' }],
        processedImageUrl: 'https://res.cloudinary.com/edubridge/image/upload/v1/biology_processed.jpg',
        processedImagePublicId: 'edubridge/textbooks/processed/biology_proc_01'
      });
      expect(updatedOcr.ocrExtractedText).toContain('Mitochondria');
      expect(updatedOcr.diagramDescriptions.length).toBe(1);
      expect(updatedOcr.processedImagePublicId).toBe('edubridge/textbooks/processed/biology_proc_01');
    });
  });

  // ==========================================================================
  // 3. lesson.repository.js
  // ==========================================================================
  describe('3. lesson.repository.js', () => {
    it('should create and retrieve an accessible multimodal lesson in Snowflake', async () => {
      createdLesson = await lessonRepository.create({
        textbookAssetId: createdMedia.id,
        userId: createdUser.id,
        title: 'Cellular Respiration & ATP Synthesis',
        summary: 'How cells convert glucose and oxygen into cellular energy.',
        simplifiedText: 'Cells use mitochondria to make ATP energy from glucose and oxygen.',
        screenReaderTranscript: 'Lesson title: Cellular Respiration. Key concept: Mitochondria converts sugar into ATP energy.',
        sensoryAnalogies: [{ concept: 'ATP', analogy: 'ATP is like a rechargeable battery holding energy for cell functions.' }],
        keyTakeaways: ['Mitochondria makes ATP', 'Oxygen is required for aerobic respiration'],
        difficultyLevel: 'beginner'
      });

      expect(createdLesson).toBeDefined();
      expect(createdLesson.id).toBeDefined();
      expect(createdLesson.title).toBe('Cellular Respiration & ATP Synthesis');
      expect(createdLesson.sensoryAnalogies.length).toBe(1);
      expect(createdLesson.keyTakeaways.length).toBe(2);

      // findById
      const found = await lessonRepository.findById(createdLesson.id);
      expect(found).not.toBeNull();
      expect(found.title).toBe(createdLesson.title);

      // findByTextbookAssetId
      const textbookLessons = await lessonRepository.findByTextbookAssetId(createdMedia.id);
      expect(textbookLessons.length).toBeGreaterThanOrEqual(1);

      // findByUserId
      const userLessons = await lessonRepository.findByUserId(createdUser.id);
      expect(userLessons.length).toBeGreaterThanOrEqual(1);
    });

    it('should update lesson audio pointers and content', async () => {
      const updatedAudio = await lessonRepository.updateAudio(createdLesson.id, {
        audioUrl: 'https://res.cloudinary.com/edubridge/video/upload/v1/lesson_narration.mp3',
        audioPublicId: 'edubridge/audio/lessons/aud_01',
        audioDurationSeconds: 145.5,
        waveformUrl: 'https://res.cloudinary.com/edubridge/image/upload/v1/lesson_waveform.png'
      });

      expect(updatedAudio.audioUrl).toContain('lesson_narration.mp3');
      expect(updatedAudio.audioDurationSeconds).toBe(145.5);
      expect(updatedAudio.waveformUrl).toContain('lesson_waveform.png');

      const updatedContent = await lessonRepository.updateContent(createdLesson.id, {
        title: 'Cellular Respiration & ATP Production (Updated)',
        summary: 'Updated summary of cellular respiration with tactile references.'
      });
      expect(updatedContent.title).toContain('(Updated)');
    });
  });

  // ==========================================================================
  // 4. question.repository.js
  // ==========================================================================
  describe('4. question.repository.js', () => {
    it('should create individual and batch assessment questions in Snowflake', async () => {
      createdQuestion = await questionRepository.create({
        lessonId: createdLesson.id,
        questionText: 'What organelle is primarily responsible for ATP production during aerobic respiration?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['Mitochondria', 'Ribosome', 'Golgi Apparatus', 'Chloroplast'],
        correctAnswer: 'Mitochondria',
        explanation: 'Mitochondria carry out the Krebs cycle and electron transport chain producing ATP.',
        audioPromptHint: 'Say the name of the organelle known as the powerhouse of the cell.',
        difficultyLevel: 'easy',
        orderIndex: 0
      });

      expect(createdQuestion).toBeDefined();
      expect(createdQuestion.id).toBeDefined();
      expect(createdQuestion.correctAnswer).toBe('Mitochondria');
      expect(createdQuestion.options.length).toBe(4);

      // createMany
      const batchQuestions = await questionRepository.createMany([
        {
          lessonId: createdLesson.id,
          questionText: 'Is oxygen consumed during glycolysis?',
          questionType: 'TRUE_FALSE',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: 'Glycolysis is anaerobic and does not require oxygen.',
          difficultyLevel: 'medium'
        },
        {
          lessonId: createdLesson.id,
          questionText: 'Describe how ATP functions as a cellular energy currency.',
          questionType: 'OPEN_ENDED_VOICE',
          correctAnswer: 'ATP stores chemical energy in high-energy phosphate bonds that release energy when hydrolyzed.',
          explanation: 'Hydrolysis of the terminal phosphate produces ADP and inorganic phosphate, releasing energy.',
          difficultyLevel: 'hard'
        }
      ]);

      expect(batchQuestions.length).toBe(2);

      // findByLessonId
      const lessonQuestions = await questionRepository.findByLessonId(createdLesson.id);
      expect(lessonQuestions.length).toBeGreaterThanOrEqual(3);

      // findByDifficulty
      const hardQuestions = await questionRepository.findByDifficulty(createdLesson.id, 'hard');
      expect(hardQuestions.some(q => q.questionType === 'OPEN_ENDED_VOICE')).toBe(true);
    });

    it('should update audio prompt hint and URL', async () => {
      const updated = await questionRepository.updateAudioPrompt(createdQuestion.id, {
        audioPromptUrl: 'https://res.cloudinary.com/edubridge/video/upload/v1/question_audio.mp3',
        audioPromptHint: 'Spoken question: What organelle produces ATP?'
      });

      expect(updated.audioPromptUrl).toContain('question_audio.mp3');
      expect(updated.audioPromptHint).toContain('Spoken question');
    });
  });

  // ==========================================================================
  // 5. attempt.repository.js
  // ==========================================================================
  describe('5. attempt.repository.js', () => {
    it('should create, record student answers, and complete quiz attempt session', async () => {
      createdAttempt = await attemptRepository.createAttempt({
        userId: createdUser.id,
        lessonId: createdLesson.id,
        totalQuestions: 2
      });

      expect(createdAttempt).toBeDefined();
      expect(createdAttempt.id).toBeDefined();
      expect(createdAttempt.status).toBe('IN_PROGRESS');

      // recordAnswer 1: correct text answer
      const afterAnswer1 = await attemptRepository.recordAnswer(createdAttempt.id, {
        questionId: createdQuestion.id,
        studentAnswer: 'Mitochondria',
        isCorrect: true,
        score: 100,
        timeTakenSeconds: 8
      });

      expect(afterAnswer1.correctQuestions).toBe(1);
      expect(afterAnswer1.answersSummary.length).toBe(1);

      // recordAnswer 2: voice answer with faster-whisper transcript
      const afterAnswer2 = await attemptRepository.recordAnswer(createdAttempt.id, {
        questionId: 'q-open-ended-02',
        studentAnswer: 'It stores energy in phosphate bonds.',
        isCorrect: true,
        score: 95,
        timeTakenSeconds: 14,
        transcript: 'It stores energy in phosphate bonds and releases it for work.',
        confidence: 0.94
      });

      expect(afterAnswer2.correctQuestions).toBe(2);
      expect(afterAnswer2.scorePercentage).toBe(100);
      expect(afterAnswer2.answersSummary.length).toBe(2);
      expect(afterAnswer2.answersSummary[1].transcript).toContain('phosphate bonds');

      // completeAttempt
      const completed = await attemptRepository.completeAttempt(createdAttempt.id, {
        totalQuestions: 2,
        correctQuestions: 2,
        scorePercentage: 97.5,
        timeSpentSeconds: 22,
        feedbackAudioUrl: 'https://res.cloudinary.com/edubridge/video/upload/v1/feedback.mp3'
      });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
      expect(completed.feedbackAudioUrl).toContain('feedback.mp3');

      // findByUserId
      const userAttempts = await attemptRepository.findByUserId(createdUser.id);
      expect(userAttempts.length).toBeGreaterThanOrEqual(1);

      // findByLessonId
      const lessonAttempts = await attemptRepository.findByLessonId(createdUser.id, createdLesson.id);
      expect(lessonAttempts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 6. mastery.repository.js
  // ==========================================================================
  describe('6. mastery.repository.js', () => {
    const conceptId = `concept_mitochondria_${timestamp}`;

    it('should upsert student concept mastery progression and history', async () => {
      const initialMastery = await masteryRepository.upsertMastery({
        userId: createdUser.id,
        conceptId,
        masteryScore: 45.0,
        attemptsCount: 1,
        correctCount: 0,
        consecutiveCorrect: 0,
        masteryLevel: 'NOVICE',
        historyEntry: { delta: 0, reason: 'Initial diagnostic attempt' }
      });

      expect(initialMastery).toBeDefined();
      expect(initialMastery.masteryScore).toBe(45.0);
      expect(initialMastery.masteryLevel).toBe('NOVICE');
      expect(initialMastery.masteryHistory.length).toBe(1);

      // Update after practice: score rises to 88
      const advancedMastery = await masteryRepository.upsertMastery({
        userId: createdUser.id,
        conceptId,
        masteryScore: 88.0,
        attemptsCount: 3,
        correctCount: 2,
        consecutiveCorrect: 2,
        masteryLevel: 'MASTERED',
        historyEntry: { delta: +43.0, reason: 'Successful practice reinforcement' }
      });

      expect(advancedMastery.masteryScore).toBe(88.0);
      expect(advancedMastery.masteryLevel).toBe('MASTERED');
      expect(advancedMastery.consecutiveCorrect).toBe(2);
      expect(advancedMastery.masteryHistory.length).toBe(2);

      // findByUserAndConcept
      const found = await masteryRepository.findByUserAndConcept(createdUser.id, conceptId);
      expect(found).not.toBeNull();
      expect(found.masteryScore).toBe(88.0);

      // getMasteredConcepts
      const masteredList = await masteryRepository.getMasteredConcepts(createdUser.id, 80);
      expect(masteredList.some(m => m.conceptId === conceptId)).toBe(true);
    });

    it('should detect weak concepts requiring reinforcement', async () => {
      const weakConceptId = `concept_krebs_cycle_${timestamp}`;
      await masteryRepository.upsertMastery({
        userId: createdUser.id,
        conceptId: weakConceptId,
        masteryScore: 35.0,
        attemptsCount: 2,
        correctCount: 0,
        consecutiveCorrect: 0,
        masteryLevel: 'NOVICE'
      });

      const weakList = await masteryRepository.getWeakConcepts(createdUser.id, 60);
      expect(weakList.some(m => m.conceptId === weakConceptId)).toBe(true);
    });
  });

  // ==========================================================================
  // 7. audio.repository.js
  // ==========================================================================
  describe('7. audio.repository.js', () => {
    let createdAudio = null;

    it('should store and retrieve synthesized Piper TTS audio metadata in Snowflake', async () => {
      createdAudio = await audioRepository.create({
        entityType: 'LESSON',
        entityId: createdLesson.id,
        audioUrl: 'https://res.cloudinary.com/edubridge/video/upload/v1/piper_lesson_audio.mp3',
        audioPublicId: 'edubridge/audio/lessons/piper_01_respiration',
        audioFormat: 'mp3',
        durationSeconds: 124.8,
        fileSizeBytes: 2048576,
        bitrateKbps: 128,
        speechRate: 1.05,
        voiceId: 'en_US-lessac-medium',
        ttsEngine: 'PIPER_TTS',
        status: 'COMPLETED'
      });

      expect(createdAudio).toBeDefined();
      expect(createdAudio.id).toBeDefined();
      expect(createdAudio.entityType).toBe('LESSON');
      expect(createdAudio.durationSeconds).toBe(124.8);
      expect(createdAudio.ttsEngine).toBe('PIPER_TTS');

      // findById
      const found = await audioRepository.findById(createdAudio.id);
      expect(found).not.toBeNull();
      expect(found.audioPublicId).toBe('edubridge/audio/lessons/piper_01_respiration');

      // findByEntity
      const foundEntity = await audioRepository.findByEntity('LESSON', createdLesson.id);
      expect(foundEntity).not.toBeNull();
      expect(foundEntity.id).toBe(createdAudio.id);

      // findByPublicId
      const foundPublic = await audioRepository.findByPublicId('edubridge/audio/lessons/piper_01_respiration');
      expect(foundPublic).not.toBeNull();
      expect(foundPublic.id).toBe(createdAudio.id);
    });

    it('should update waveform data and audio status', async () => {
      const updatedWaveform = await audioRepository.updateWaveform(createdAudio.id, {
        waveformUrl: 'https://res.cloudinary.com/edubridge/image/upload/v1/waveform_peaks.png',
        waveformData: [0.1, 0.4, 0.8, 0.95, 0.6, 0.3, 0.15]
      });

      expect(updatedWaveform.waveformUrl).toContain('waveform_peaks.png');
      expect(Array.isArray(updatedWaveform.waveformData)).toBe(true);
      expect(updatedWaveform.waveformData.length).toBe(7);

      const updatedStatus = await audioRepository.updateStatus(createdAudio.id, {
        status: 'ARCHIVED',
        retryCount: 0
      });
      expect(updatedStatus.status).toBe('ARCHIVED');
    });
  });
});
