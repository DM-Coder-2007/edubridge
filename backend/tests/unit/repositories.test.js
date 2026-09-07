/**
 * EduBridge Adaptive - Unit Tests: Repositories (Snowflake Data Layer)
 */

const userRepository = require('../../src/repositories/userRepository');
const textbookRepository = require('../../src/repositories/textbookRepository');
const processingStatusRepository = require('../../src/repositories/processingStatusRepository');
const lessonRepository = require('../../src/repositories/lessonRepository');
const conceptRepository = require('../../src/repositories/conceptRepository');
const quizRepository = require('../../src/repositories/quizRepository');
const progressRepository = require('../../src/repositories/progressRepository');

describe('Repositories: Snowflake Data Layer', () => {
  let testUser;
  let testTextbook;
  let testLesson;
  let testConcept;

  describe('UserRepository', () => {
    it('should create and retrieve a user in Snowflake', async () => {
      const email = `test_${Date.now()}@edubridge.org`;
      testUser = await userRepository.create({
        email,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Alex Student',
        role: 'student',
        gradeLevel: 'Grade 9',
        preferredLanguage: 'en',
        accessibilityPreferences: { highContrast: true, ttsSpeed: 1.25 }
      });

      expect(testUser).toBeDefined();
      expect(testUser.id).toBeDefined();
      expect(testUser.email).toBe(email);
      expect(testUser.accessibilityPreferences.highContrast).toBe(true);

      const foundByEmail = await userRepository.findByEmail(email);
      expect(foundByEmail).toBeDefined();
      expect(foundByEmail.id).toBe(testUser.id);

      const foundById = await userRepository.findById(testUser.id);
      expect(foundById).toBeDefined();
      expect(foundById.fullName).toBe('Alex Student');
    });

    it('should update user accessibility preferences', async () => {
      const updated = await userRepository.updatePreferences(testUser.id, {
        highContrast: false,
        ttsSpeed: 1.5,
        audioNarrationAutoPlay: true
      });

      expect(updated.accessibilityPreferences.ttsSpeed).toBe(1.5);
      expect(updated.accessibilityPreferences.audioNarrationAutoPlay).toBe(true);
    });
  });

  describe('TextbookRepository', () => {
    it('should create and retrieve textbook scan record', async () => {
      testTextbook = await textbookRepository.create({
        userId: testUser.id,
        title: 'Biology Chapter 4 - Cell Division',
        subject: 'Biology',
        gradeLevel: 'Grade 9',
        chapterTitle: 'Mitosis and Meiosis',
        rawImageUrl: 'https://res.cloudinary.com/demo/image/upload/raw_cell.jpg',
        rawImagePublicId: 'edubridge/textbooks/raw/cell_123',
        processingStatus: 'UPLOADED'
      });

      expect(testTextbook).toBeDefined();
      expect(testTextbook.id).toBeDefined();
      expect(testTextbook.title).toBe('Biology Chapter 4 - Cell Division');

      const byUser = await textbookRepository.findByUserId(testUser.id);
      expect(byUser.length).toBeGreaterThan(0);
      expect(byUser.some(t => t.id === testTextbook.id)).toBe(true);
    });

    it('should update processing status', async () => {
      const updated = await textbookRepository.updateProcessingStatus(testTextbook.id, 'COMPLETED', {
        processedImageUrl: 'https://res.cloudinary.com/demo/image/upload/proc_cell.jpg',
        processedImagePublicId: 'edubridge/textbooks/processed/proc_cell_123'
      });

      expect(updated.processingStatus).toBe('COMPLETED');
      expect(updated.processedImageUrl).toBeDefined();
    });
  });

  describe('ProcessingStatusRepository', () => {
    it('should create and update pipeline processing status', async () => {
      const status = await processingStatusRepository.create({
        textbookId: testTextbook.id,
        currentStage: 'OCR',
        progressPercentage: 25
      });

      expect(status.currentStage).toBe('OCR');
      expect(status.progressPercentage).toBe(25);

      const updated = await processingStatusRepository.update(testTextbook.id, {
        currentStage: 'COMPLETED',
        progressPercentage: 100
      });

      expect(updated.currentStage).toBe('COMPLETED');
      expect(updated.progressPercentage).toBe(100);
    });
  });

  describe('LessonRepository', () => {
    it('should create and retrieve lesson with tactile diagrams', async () => {
      testLesson = await lessonRepository.create({
        textbookId: testTextbook.id,
        userId: testUser.id,
        title: 'Understanding Mitosis',
        summary: 'A short overview of cell division',
        simplifiedText: 'Think of mitosis like carefully photocopying a book...',
        screenReaderTranscript: 'Mitosis is the process of nuclear cell division...'
      });

      expect(testLesson.id).toBeDefined();
      expect(testLesson.title).toBe('Understanding Mitosis');
      expect(testLesson.simplifiedText).toContain('photocopying');

      const found = await lessonRepository.findById(testLesson.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Understanding Mitosis');
      expect(found.title).toBe('Understanding Mitosis');
    });

    it('should update lesson audio metadata from Piper TTS', async () => {
      const updated = await lessonRepository.updateAudio(testLesson.id, {
        audioUrl: 'https://res.cloudinary.com/demo/video/upload/mitosis_narration.mp3',
        audioPublicId: 'edubridge/audio/mitosis_123',
        audioDurationSeconds: 142.5,
        waveformUrl: 'https://res.cloudinary.com/demo/image/upload/mitosis_waveform.json'
      });

      expect(updated.audioUrl).toBe('https://res.cloudinary.com/demo/video/upload/mitosis_narration.mp3');
      expect(updated.audioDurationSeconds).toBe(142.5);
    });
  });

  describe('ConceptRepository', () => {
    it('should create and retrieve concepts for a lesson', async () => {
      const concepts = await conceptRepository.createMany([
        {
          lessonId: testLesson.id,
          name: 'Chromatid Alignment',
          definition: 'Chromosomes align along the metaphase plate.',
          sensoryAnalogy: 'Imagine dancers holding hands along the equator of the dance floor.',
          difficultyLevel: 'INTERMEDIATE'
        }
      ]);

      expect(concepts.length).toBe(1);
      testConcept = concepts[0];
      expect(testConcept.name).toBe('Chromatid Alignment');

      const byLesson = await conceptRepository.findByLessonId(testLesson.id);
      expect(byLesson.length).toBeGreaterThan(0);
      expect(byLesson[0].name).toBe('Chromatid Alignment');
    });
  });

  describe('QuizRepository', () => {
    let testQuestion;
    let testAttempt;

    it('should create questions and quiz attempt', async () => {
      const questions = await quizRepository.createQuestions([
        {
          lessonId: testLesson.id,
          conceptId: testConcept.id,
          questionText: 'During which phase do chromosomes line up in the center?',
          questionType: 'SHORT_ANSWER',
          correctAnswer: 'Metaphase',
          explanation: 'In metaphase, chromosomes align along the cell equator.'
        }
      ]);

      expect(questions.length).toBe(1);
      testQuestion = questions[0];
      expect(testQuestion.correctAnswer).toBe('Metaphase');

      testAttempt = await quizRepository.createAttempt({
        userId: testUser.id,
        lessonId: testLesson.id,
        totalQuestions: 1
      });

      expect(testAttempt.id).toBeDefined();
      expect(testAttempt.scorePercentage).toBe(0);
    });

    it('should record an answer and update attempt score', async () => {
      const answer = await quizRepository.recordAnswer({
        attemptId: testAttempt.id,
        questionId: testQuestion.id,
        userId: testUser.id,
        userAnswerText: 'Chromosomes align during metaphase',
        isCorrect: true,
        aiScore: 95,
        aiFeedback: 'Great job! You identified metaphase accurately.'
      });

      expect(answer.isCorrect).toBe(true);
      expect(answer.aiScore).toBe(95);

      const updatedAttempt = await quizRepository.updateAttemptScore(testAttempt.id, {
        correctQuestions: 1,
        totalQuestions: 1,
        scorePercentage: 100,
        timeSpentSeconds: 45
      });

      expect(updatedAttempt.scorePercentage).toBe(100);
      expect(updatedAttempt.status).toBe('COMPLETED');
    });
  });

  describe('ProgressRepository', () => {
    it('should upsert and retrieve progress and concept mastery', async () => {
      const progress = await progressRepository.upsertProgress({
        userId: testUser.id,
        lessonId: testLesson.id,
        completionPercentage: 100,
        lastAudioPositionSeconds: 142.5,
        status: 'COMPLETED'
      });

      expect(progress.completionPercentage).toBe(100);
      expect(progress.status).toBe('COMPLETED');

      const mastery = await progressRepository.updateMastery({
        userId: testUser.id,
        conceptId: testConcept.id,
        isCorrect: true
      });

      expect(mastery.masteryScore).toBeGreaterThanOrEqual(10);

      const allMastery = await progressRepository.getMasteryForUser(testUser.id);
      expect(allMastery.length).toBeGreaterThan(0);
    });
  });
});
