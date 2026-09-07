/**
 * EduBridge Adaptive - Gemini AI & Adaptive Learning Engine Test Suite
 *
 * Verifies:
 * 1. Multimodal lesson generation with strict schema validation
 * 2. Formative question generation with voice prompt hints
 * 3. Answer evaluation with misconception detection and difficulty recommendation
 * 4. Resilient retry on malformed JSON & permanent failure marking with diagnostic logs
 * 5. Zero secret leakage (GEMINI_API_KEY never exposed)
 * 6. Concept mastery calculation with forgetting curve decay & streak updates
 * 7. Adaptive difficulty progression (easy -> medium -> hard and regression)
 * 8. Audio-first adaptive feedback generation with sensory analogies
 * 9. Dynamic next question selection and on-the-fly remediation synthesis
 */

process.env.NODE_ENV = 'test';
process.env.GEMINI_MOCK_FALLBACK = 'true';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const client = require('../../src/integrations/gemini/client');
const schemas = require('../../src/integrations/gemini/schemas');
const prompts = require('../../src/integrations/gemini/prompts');
const generationService = require('../../src/integrations/gemini/generation.service');
const evaluationService = require('../../src/integrations/gemini/evaluation.service');
const {
  masteryService,
  difficultyService,
  feedbackService,
  nextQuestionService
} = require('../../src/services/adaptive');
const aiMetadataRepository = require('../../src/repositories/aiMetadataRepository');
const quizRepository = require('../../src/repositories/quizRepository');
const databaseManager = require('../../src/database/snowflake/databaseManager');

describe('Gemini AI & Adaptive Engine: EduBridge Adaptive', () => {
  beforeAll(async () => {
    await databaseManager.initializeDatabase();
  });

  afterEach(() => {
    client.clearMockOverrides();
  });

  // ==========================================================================
  // 1. Client Security & Secret Leakage Prevention
  // ==========================================================================
  describe('1. Gemini Client Security & Sanity', () => {
    it('should never expose raw GEMINI_API_KEY in getSafeConfig()', () => {
      const config = client.getSafeConfig();
      expect(config).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.apiKey).toContain('****');
      expect(config.apiKey).not.toBe(process.env.GEMINI_API_KEY);
    });

    it('should report healthy ping status in mock mode', async () => {
      const ping = await client.ping();
      expect(ping.status).toBe('healthy');
      expect(ping.connected).toBe(true);
      expect(ping.mode).toBe('MOCK_EMULATION');
    });
  });

  // ==========================================================================
  // 2. Multimodal Lesson & Question Generation
  // ==========================================================================
  describe('2. Schema-Validated Content Generation', () => {
    it('should generate an accessible lesson conforming to schema', async () => {
      const lesson = await generationService.generateLessonFromContent({
        textbookTitle: 'Cell Biology',
        subject: 'Life Science',
        gradeLevel: 'Grade 7',
        extractedContent: 'Plant cells contain rigid walls of cellulose.',
        diagramDescriptions: ['Rectangular cell with outer border.'],
        entityId: 'test_lesson_1'
      });

      expect(lesson).toBeDefined();
      expect(lesson.title).toBeDefined();
      expect(lesson.simplifiedText).toBeDefined();
      expect(lesson.screenReaderTranscript).toBeDefined();
      expect(Array.isArray(lesson.concepts)).toBe(true);
      expect(lesson.concepts.length).toBeGreaterThan(0);
      expect(lesson.concepts[0].name).toBeDefined();

      // Validate schema parser directly
      expect(schemas.validateLessonResponse(lesson)).toBe(true);
    });

    it('should generate comprehension questions with audio prompt hints', async () => {
      const questions = await generationService.generateQuestions({
        lessonTitle: 'Plant Cells',
        subject: 'Biology',
        concepts: [{ name: 'Cell Wall' }, { name: 'Chloroplast' }],
        count: 2,
        targetDifficulty: 'medium',
        entityId: 'test_q_gen'
      });

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThanOrEqual(1);

      const q = questions[0];
      expect(q.questionText).toBeDefined();
      expect(q.correctAnswer).toBeDefined();
      expect(q.explanation).toBeDefined();
      expect(q.audioPromptHint).toBeDefined();
      expect(['easy', 'medium', 'hard']).toContain(q.difficultyLevel.toLowerCase());

      expect(schemas.validateQuestionsResponse(questions)).toBe(true);
    });

    it('should generate a simpler scaffolded explanation for struggling concepts', async () => {
      const explanation = await generationService.generateSimplerExplanation({
        conceptName: 'Plant Cell Wall',
        currentExplanation: 'The outer layer of cellulose that holds the cell together.',
        studentMisconception: 'Thought it was made of muscle tissue',
        entityId: 'test_simpler_1'
      });

      expect(explanation).toBeDefined();
      expect(explanation.conceptName).toBe('Plant Cell Wall');
      expect(explanation.simplifiedExplanation).toBeDefined();
      expect(explanation.tactileAnalogy).toBeDefined();
      expect(explanation.auditoryAnalogy).toBeDefined();
      expect(Array.isArray(explanation.stepByStepBreakdown)).toBe(true);

      expect(schemas.validateSimplerExplanationResponse(explanation)).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Student Answer Evaluation
  // ==========================================================================
  describe('3. Student Answer Evaluation', () => {
    it('should evaluate a correct conceptual answer with high score and encouraging feedback', async () => {
      const evaluation = await evaluationService.evaluateStudentAnswer({
        questionText: 'What is the primary function of the plant cell wall?',
        correctAnswer: 'Providing structural support and protection',
        explanation: 'The wall acts as a rigid boundary maintaining shape.',
        studentAnswer: 'It provides structural support to keep the plant rigid',
        conceptName: 'Plant Cell Wall',
        entityId: 'test_eval_correct'
      });

      expect(evaluation.isCorrect).toBe(true);
      expect(evaluation.score).toBeGreaterThanOrEqual(80);
      expect(evaluation.feedback).toBeDefined();
      expect(schemas.validateEvaluationResponse(evaluation)).toBe(true);
    });

    it('should evaluate an incorrect answer and identify struggling concept', async () => {
      // Use "wrong_test_answer" keyword which synthetic mock evaluates as incorrect
      const evaluation = await evaluationService.evaluateStudentAnswer({
        questionText: 'What is the primary function of the plant cell wall?',
        correctAnswer: 'Providing structural support and protection',
        explanation: 'The wall acts as a rigid boundary maintaining shape.',
        studentAnswer: 'wrong_test_answer: It pumps blood through the plant veins',
        conceptName: 'Plant Cell Wall',
        entityId: 'test_eval_wrong'
      });

      expect(evaluation.isCorrect).toBe(false);
      expect(evaluation.score).toBeLessThan(60);
      expect(evaluation.feedback).toBeDefined();
      expect(evaluation.recommendedNextDifficulty).toBe('easy');
      expect(schemas.validateEvaluationResponse(evaluation)).toBe(true);
    });

    it('should handle empty or blank student answers gracefully without API call', async () => {
      const evaluation = await evaluationService.evaluateStudentAnswer({
        questionText: 'Explain photosynthesis.',
        correctAnswer: 'Plants converting light to glucose.',
        studentAnswer: '   ',
        conceptName: 'Photosynthesis'
      });

      expect(evaluation.isCorrect).toBe(false);
      expect(evaluation.score).toBe(0);
      expect(evaluation.feedback).toContain('No answer was detected');
      expect(evaluation.recommendedNextDifficulty).toBe('easy');
    });
  });

  // ==========================================================================
  // 4. Resilience, Schema Retry, and Permanent Failure Handling
  // ==========================================================================
  describe('4. AI Resilience & Malformed Response Recovery', () => {
    it('should safely recover when Gemini returns malformed JSON on attempt 1, then valid JSON on retry', async () => {
      // Enqueue malformed JSON followed by valid JSON
      client.enqueueMockResponse('MALFORMED_NON_JSON_OUTPUT_ERROR_123');
      client.enqueueMockResponse(
        JSON.stringify({
          isCorrect: true,
          score: 90,
          feedback: 'Recovered after retry with valid JSON!',
          weakConcepts: [],
          recommendedNextDifficulty: 'medium',
          followupQuestion: null
        })
      );

      const result = await evaluationService.evaluateStudentAnswer({
        questionText: 'Sample question',
        correctAnswer: 'Sample answer',
        studentAnswer: 'Sample student answer',
        entityId: 'test_retry_recovery'
      });

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(90);
      expect(result.feedback).toContain('Recovered after retry');
    });

    it('should mark operation FAILED in AI metadata if all retries are exhausted', async () => {
      // Enqueue 3 malformed responses (exceeding maxRetries = 2)
      client.enqueueMockResponse('CORRUPT_OUTPUT_1');
      client.enqueueMockResponse('CORRUPT_OUTPUT_2');
      client.enqueueMockResponse('CORRUPT_OUTPUT_3');

      await expect(
        evaluationService.evaluateStudentAnswer({
          questionText: 'Sample question',
          correctAnswer: 'Sample answer',
          studentAnswer: 'Student attempt',
          entityId: 'test_exhausted_retries'
        })
      ).rejects.toThrow(/AI answer evaluation failed/);

      // Verify failure was recorded in Snowflake AI metadata
      const logs = await aiMetadataRepository.getAuditForEntity('test_exhausted_retries');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].rawResponse).toContain('FAILED');
    });
  });

  // ==========================================================================
  // 5. Spaced Repetition & Concept Mastery Service
  // ==========================================================================
  describe('5. Cognitive Mastery & Spaced Repetition (MasteryService)', () => {
    it('should compute appropriate categorical mastery levels', () => {
      expect(masteryService.computeMasteryLevel(95, 3, 4)).toBe('MASTERED');
      expect(masteryService.computeMasteryLevel(75, 1, 2)).toBe('PROFICIENT');
      expect(masteryService.computeMasteryLevel(50, 0, 1)).toBe('DEVELOPING');
      expect(masteryService.computeMasteryLevel(30, 0, 1)).toBe('NOVICE');
    });

    it('should apply spaced repetition decay over elapsed days without practice', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const { decayedScore, daysElapsed } = masteryService.calculateDecayedScore(100, tenDaysAgo, 0.05);

      expect(daysElapsed).toBeCloseTo(10, 0);
      // 100 * e^(-0.05 * 10) = 100 * e^(-0.5) ≈ 60.65
      expect(decayedScore).toBeLessThan(100);
      expect(decayedScore).toBeGreaterThan(50);
      expect(decayedScore).toBeCloseTo(60.65, 0);
    });

    it('should calculate mastery update on correct answer with streak acceleration', () => {
      const update = masteryService.calculateMasteryUpdate({
        currentScore: 60,
        consecutiveCorrect: 2,
        attemptsCount: 2,
        correctCount: 2,
        isCorrect: true,
        score: 95
      });

      expect(update.masteryScore).toBeGreaterThan(60);
      expect(update.consecutiveCorrect).toBe(3);
      expect(update.delta).toBeGreaterThan(0);
    });

    it('should record concept attempt and persist mastery history to Snowflake', async () => {
      const userId = `usr_adaptive_rec_${Date.now()}`;
      const conceptId = `cpt_photo_${Date.now()}`;

      const result = await masteryService.recordConceptAttempt({
        userId,
        conceptId,
        isCorrect: true,
        score: 90,
        conceptName: 'Photosynthesis Core'
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.conceptId).toBe(conceptId);
      expect(result.masteryScore).toBeGreaterThan(0);
      expect(result.history.length).toBe(1);

      // Subsequent attempt
      const result2 = await masteryService.recordConceptAttempt({
        userId,
        conceptId,
        isCorrect: true,
        score: 95,
        conceptName: 'Photosynthesis Core'
      });

      expect(result2.attemptsCount).toBe(2);
      expect(result2.consecutiveCorrect).toBe(2);
      expect(result2.history.length).toBe(2);

      // Verify retrieval from Snowflake
      const retrieved = await masteryService.getConceptMastery(userId, conceptId);
      expect(retrieved).toBeDefined();
      expect(retrieved.masteryScore).toBe(result2.masteryScore);
      expect(retrieved.attemptsCount).toBe(2);
    });

    it('should aggregate user mastery summary and identify struggling concepts', async () => {
      const userId = 'usr_adaptive_summary';

      // 1 mastered concept
      await masteryService.recordConceptAttempt({
        userId,
        conceptId: 'cpt_easy_math',
        isCorrect: true,
        score: 95
      });
      await masteryService.recordConceptAttempt({
        userId,
        conceptId: 'cpt_easy_math',
        isCorrect: true,
        score: 100
      });

      // 1 struggling concept
      await masteryService.recordConceptAttempt({
        userId,
        conceptId: 'cpt_hard_calculus',
        isCorrect: false,
        score: 20
      });

      const summary = await masteryService.getUserMasterySummary(userId);
      expect(summary.totalConceptsTracked).toBe(2);
      expect(summary.averageMastery).toBeGreaterThan(0);

      const struggling = await masteryService.getStrugglingConcepts(userId, 65);
      expect(struggling.length).toBe(1);
      expect(struggling[0].conceptId).toBe('cpt_hard_calculus');
    });
  });

  // ==========================================================================
  // 6. Adaptive Difficulty Progression
  // ==========================================================================
  describe('6. Difficulty Progression Service (DifficultyService)', () => {
    it('should normalize arbitrary difficulty strings and numbers', () => {
      expect(difficultyService.normalizeDifficulty('easy')).toBe('easy');
      expect(difficultyService.normalizeDifficulty('Intermediate')).toBe('medium');
      expect(difficultyService.normalizeDifficulty('Advanced')).toBe('hard');
      expect(difficultyService.normalizeDifficulty(1)).toBe('easy');
      expect(difficultyService.normalizeDifficulty(2)).toBe('medium');
      expect(difficultyService.normalizeDifficulty(3)).toBe('hard');
    });

    it('should promote difficulty: easy -> medium after 2 consecutive correct answers', () => {
      const result = difficultyService.determineNextDifficulty({
        currentDifficulty: 'easy',
        isCorrect: true,
        score: 90,
        consecutiveCorrect: 2
      });

      expect(result.nextDifficulty).toBe('medium');
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('UP');
      expect(result.voiceAnnouncement.toLowerCase()).toContain('rising tone');
    });

    it('should promote difficulty: medium -> hard after sustained high performance', () => {
      const result = difficultyService.determineNextDifficulty({
        currentDifficulty: 'medium',
        isCorrect: true,
        score: 95,
        consecutiveCorrect: 3,
        aiRecommendation: 'hard'
      });

      expect(result.nextDifficulty).toBe('hard');
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('UP');
      expect(result.voiceAnnouncement).toContain('Challenge unlocked');
    });

    it('should demote difficulty: hard -> medium when struggling', () => {
      const result = difficultyService.determineNextDifficulty({
        currentDifficulty: 'hard',
        isCorrect: false,
        score: 30,
        consecutiveIncorrect: 1
      });

      expect(result.nextDifficulty).toBe('medium');
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('DOWN');
    });

    it('should demote difficulty: medium -> easy when student misses repeatedly', () => {
      const result = difficultyService.determineNextDifficulty({
        currentDifficulty: 'medium',
        isCorrect: false,
        score: 25,
        consecutiveIncorrect: 2
      });

      expect(result.nextDifficulty).toBe('easy');
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('DOWN');
      expect(result.voiceAnnouncement).toContain('slow down and practice the fundamentals');
    });
  });

  // ==========================================================================
  // 7. Audio-First Adaptive Feedback Service
  // ==========================================================================
  describe('7. Adaptive Feedback Service (FeedbackService)', () => {
    it('should build positive audio feedback for a correct response', async () => {
      const feedback = await feedbackService.buildAdaptiveFeedback({
        evaluation: {
          isCorrect: true,
          score: 95,
          feedback: 'You explained the cell wall perfectly!',
          weakConcepts: []
        },
        question: {
          questionText: 'What protects the plant cell?',
          correctAnswer: 'Rigid cell wall',
          explanation: 'It provides structural support like a frame.'
        },
        studentAnswer: 'The rigid cell wall protects it.'
      });

      expect(feedback.isCorrect).toBe(true);
      expect(feedback.audioCue).toContain('Audio Cue: bright chime');
      expect(feedback.spokenFeedback).toContain('explained the cell wall perfectly');
      expect(feedback.screenReaderTranscript).toContain('Assessment Result: Correct');
    });

    it('should build scaffolded remediation with tactile analogies for an incorrect response', async () => {
      const feedback = await feedbackService.buildAdaptiveFeedback({
        evaluation: {
          isCorrect: false,
          score: 35,
          feedback: "That was a good attempt, but let's review.",
          weakConcepts: ['Plant Cell Wall']
        },
        question: {
          questionText: 'What protects the plant cell?',
          correctAnswer: 'Rigid cell wall',
          explanation: 'It provides structural support.'
        },
        studentAnswer: 'It is soft like rubber',
        generateDeepScaffold: true
      });

      expect(feedback.isCorrect).toBe(false);
      expect(feedback.audioCue).toContain('Audio Cue: gentle low bell');
      expect(feedback.spokenFeedback).toBeDefined();
      expect(feedback.screenReaderTranscript).toContain('Assessment Result: Needs Review');
      expect(feedback.sensoryAnalogy).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. Dynamic Next Question Selection & Generation
  // ==========================================================================
  describe('8. Next Question Selection & Remediation (NextQuestionService)', () => {
    const testLessonId = 'les_adaptive_next_q_test';

    beforeAll(async () => {
      // Seed pre-existing questions in Snowflake for this lesson
      await quizRepository.createQuestion({
        lessonId: testLessonId,
        conceptId: 'cpt_cell_wall',
        questionText: 'Existing easy question on cell wall?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['Choice 1', 'Choice 2'],
        correctAnswer: 'Choice 1',
        explanation: 'Explanation',
        difficultyLevel: 'easy'
      });

      await quizRepository.createQuestion({
        lessonId: testLessonId,
        conceptId: 'cpt_chloroplast',
        questionText: 'Existing medium question on chloroplast?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['Choice 1', 'Choice 2'],
        correctAnswer: 'Choice 1',
        explanation: 'Explanation',
        difficultyLevel: 'medium'
      });
    });

    it('should select an existing question matching student weak concept and difficulty', async () => {
      const nextQ = await nextQuestionService.selectOrGenerateNextQuestion({
        userId: 'usr_test_next_q',
        lessonId: testLessonId,
        targetDifficulty: 'easy',
        weakConcepts: ['cpt_cell_wall']
      });

      expect(nextQ).toBeDefined();
      expect(nextQ.questionText).toContain('Existing easy question on cell wall');
      expect(nextQ.isDynamicallyGenerated).toBe(false);
    });

    it('should dynamically synthesize and save a new adaptive question when existing are exhausted', async () => {
      // Fetch all existing questions to exclude them
      const existing = await quizRepository.findQuestionsByLessonId(testLessonId);
      const excludeIds = existing.map(q => q.id);

      const dynamicQ = await nextQuestionService.selectOrGenerateNextQuestion({
        userId: 'usr_test_next_q',
        lessonId: testLessonId,
        targetDifficulty: 'hard',
        weakConcepts: ['cpt_complex_mitochondria'],
        lastMisconception: 'Confused ATP with ADP',
        excludeQuestionIds: excludeIds
      });

      expect(dynamicQ).toBeDefined();
      expect(dynamicQ.isDynamicallyGenerated).toBe(true);
      expect(dynamicQ.questionText).toBeDefined();
      expect(dynamicQ.correctAnswer).toBeDefined();

      // Verify that this dynamically synthesized question was saved in Snowflake
      const saved = await quizRepository.findQuestionById(dynamicQ.id);
      expect(saved).toBeDefined();
      expect(saved.id).toBe(dynamicQ.id);
      expect(saved.lessonId).toBe(testLessonId);
    });
  });
});
