/**
 * EduBridge Adaptive - Adaptive Learning Engine Deterministic Test Suite
 *
 * Verifies:
 * 1. Weak concept scenario: 5 attempts, 2 correct -> mastery decreases/remains low, triggers simpler explanation, analogy, easier question, reinforcement
 * 2. Strong concept scenario: 5 attempts, 5 correct -> mastery increases, triggers harder question, application problem, advanced explanation
 * 3. Mixed scenario: recent failures after historical success -> recent performance strongly influences difficulty and triggers reinforcement
 * 4. Multi-factor influences:
 *    - Time taken (fluency vs hesitation/rushing)
 *    - Question difficulty weighting (easy vs hard)
 *    - Consecutive streaks (correct streak acceleration vs consecutive failure intervention)
 * 5. Mandatory Snowflake persistence for all mastery modifications
 * 6. Security guard: Rejection of direct client/frontend mutations to mastery
 * 7. Canonical output verification:
 *    - correctness
 *    - updated mastery
 *    - feedback
 *    - recommended difficulty
 *    - next question
 *    - reinforcement requirement
 */

process.env.NODE_ENV = 'test';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';
process.env.GEMINI_MOCK_FALLBACK = 'true';

const {
  masteryService,
  difficultyService,
  reinforcementService,
  recommendationService
} = require('../../src/services/adaptive');
const databaseManager = require('../../src/database/snowflake/databaseManager');

describe('Adaptive Learning Engine: Cognitive Adaptation & Progression', () => {
  beforeAll(async () => {
    await databaseManager.initializeDatabase();
  });

  // ==========================================================================
  // 1. Weak Concept Behavior
  // ==========================================================================
  describe('1. Weak Concept Handling', () => {
    it('5 attempts, 2 correct: mastery should decrease / remain low (<= 40, NOVICE)', () => {
      // Simulate 5 attempts where only 2 are correct: [correct, incorrect, incorrect, correct, incorrect]
      let score = 50;
      const history = [];

      const attempts = [
        { isCorrect: true, timeTaken: 30 },
        { isCorrect: false, timeTaken: 45 },
        { isCorrect: false, timeTaken: 40 },
        { isCorrect: true, timeTaken: 35 },
        { isCorrect: false, timeTaken: 50 }
      ];

      let lastResult;
      for (const att of attempts) {
        lastResult = masteryService.calculateMasteryUpdate({
          currentScore: score,
          previousAttempts: history,
          isCorrect: att.isCorrect,
          timeTaken: att.timeTaken,
          difficulty: 'medium'
        });
        score = lastResult.masteryScore;
        history.push({ isCorrect: att.isCorrect, timeTaken: att.timeTaken });
      }

      // Mastery must decrease or remain low (<= 40)
      expect(lastResult.masteryScore).toBeLessThanOrEqual(40);
      expect(lastResult.masteryLevel).toBe('NOVICE');
      expect(lastResult.historicalAccuracy).toBe(0.40); // 2/5
    });

    it('Weak concept must recommend: simpler explanation, analogy, easier question, and reinforcement', async () => {
      const result = await recommendationService.processAdaptiveAttempt({
        question: {
          id: 'q_weak_test',
          questionText: 'Explain the mechanism of ATP synthase.',
          difficultyLevel: 'medium',
          explanation: 'ATP synthase uses a proton gradient across the inner membrane.'
        },
        concept: {
          id: 'cpt_atp_synthase',
          name: 'ATP Synthase Mechanism',
          explanation: 'A molecular rotary motor that produces ATP.',
          simplifiedAnalogy: 'Like a waterwheel driven by a mountain stream.'
        },
        studentAnswer: 'It pumps water out of the cell',
        correctness: false,
        timeTaken: 55,
        previousAttempts: [
          { isCorrect: true, timeTaken: 30 },
          { isCorrect: false, timeTaken: 40 },
          { isCorrect: false, timeTaken: 50 }
        ],
        previousMastery: 35,
        questionDifficulty: 'medium'
      });

      // 1. Correctness
      expect(result.correctness).toBe(false);

      // 2. Updated mastery remains low
      expect(result.updatedMastery.masteryScore).toBeLessThanOrEqual(40);
      expect(result.updatedMastery.masteryLevel).toBe('NOVICE');

      // 3. Recommended difficulty adjusts down to easy
      expect(result.recommendedDifficulty).toBe('easy');

      // 4. Reinforcement requirement is flagged as TRUE with High/Medium urgency
      expect(result.reinforcementRequirement.requiresReinforcement).toBe(true);
      expect(result.reinforcementRequirement.reinforcementType).toMatch(/SIMPLER_EXPLANATION|SENSORY_ANALOGY/);

      // 5. Feedback includes simpler explanation and sensory analogy
      expect(result.feedback.simplerExplanation).toBeDefined();
      expect(result.feedback.sensoryAnalogy).toBeDefined();
      expect(result.feedback.audioCue).toContain('Audio Cue: gentle low bell');

      // 6. Next question targets foundational/easier challenge
      expect(result.nextQuestion.difficultyLevel).toBe('easy');
      expect(result.nextQuestion.questionText).toMatch(/Foundational|waterwheel|ATP/i);
    });
  });

  // ==========================================================================
  // 2. Strong Concept Behavior
  // ==========================================================================
  describe('2. Strong Concept Handling', () => {
    it('5 attempts, 5 correct: mastery should increase to high levels (>= 85, MASTERED)', () => {
      let score = 40;
      const history = [];

      const attempts = [
        { isCorrect: true, timeTaken: 25 },
        { isCorrect: true, timeTaken: 22 },
        { isCorrect: true, timeTaken: 20 },
        { isCorrect: true, timeTaken: 18 },
        { isCorrect: true, timeTaken: 19 }
      ];

      let lastResult;
      for (const att of attempts) {
        lastResult = masteryService.calculateMasteryUpdate({
          currentScore: score,
          previousAttempts: history,
          isCorrect: att.isCorrect,
          timeTaken: att.timeTaken,
          difficulty: 'medium'
        });
        score = lastResult.masteryScore;
        history.push({ isCorrect: att.isCorrect, timeTaken: att.timeTaken });
      }

      // Mastery must be high (>= 85, MASTERED)
      expect(lastResult.masteryScore).toBeGreaterThanOrEqual(85);
      expect(lastResult.masteryLevel).toBe('MASTERED');
      expect(lastResult.consecutiveCorrect).toBe(5);
      expect(lastResult.historicalAccuracy).toBe(1.0);
    });

    it('Strong concept must recommend: harder question, application problem, advanced explanation, and NO reinforcement', async () => {
      const result = await recommendationService.processAdaptiveAttempt({
        question: {
          id: 'q_strong_test',
          questionText: 'What generates the electrochemical gradient powering ATP synthase?',
          difficultyLevel: 'medium',
          explanation: 'The electron transport chain pumping protons into the intermembrane space.'
        },
        concept: {
          id: 'cpt_proton_gradient',
          name: 'Proton Electrochemical Gradient',
          explanation: 'Chemiosmotic potential across the membrane.'
        },
        studentAnswer: 'Protons pumped into the intermembrane space during electron transport',
        correctness: true,
        timeTaken: 18,
        previousAttempts: [
          { isCorrect: true, timeTaken: 20 },
          { isCorrect: true, timeTaken: 22 },
          { isCorrect: true, timeTaken: 19 },
          { isCorrect: true, timeTaken: 21 }
        ],
        previousMastery: 84,
        questionDifficulty: 'medium'
      });

      expect(result.correctness).toBe(true);

      // Mastery reaches MASTERED
      expect(result.updatedMastery.masteryScore).toBeGreaterThanOrEqual(85);
      expect(result.updatedMastery.masteryLevel).toBe('MASTERED');

      // Recommended difficulty advances to hard
      expect(result.recommendedDifficulty).toBe('hard');

      // No remedial reinforcement needed for strong concept
      expect(result.reinforcementRequirement.requiresReinforcement).toBe(false);
      expect(result.reinforcementRequirement.reinforcementType).toBe('APPLICATION_CHALLENGE');

      // Advanced explanation provided
      expect(result.feedback.advancedExplanation).toBeDefined();
      expect(result.feedback.audioCue).toContain('Audio Cue: bright chime');

      // Next question targets advanced application challenge
      expect(result.nextQuestion.difficultyLevel).toBe('hard');
      expect(result.nextQuestion.questionText).toMatch(/Advanced application|challenge/i);
    });
  });

  // ==========================================================================
  // 3. Mixed Scenario: Recent Failures after Historical Success
  // ==========================================================================
  describe('3. Mixed Scenario: Recent Performance Influence', () => {
    it('recent failures after historical success must lower difficulty and require reinforcement', async () => {
      // Historical success: 5 consecutive correct answers previously
      const historicalSuccess = [
        { isCorrect: true, timeTaken: 20 },
        { isCorrect: true, timeTaken: 22 },
        { isCorrect: true, timeTaken: 24 },
        { isCorrect: true, timeTaken: 21 },
        { isCorrect: true, timeTaken: 20 }
      ];

      // Recent 2 consecutive failures
      const recentAttempts = [
        ...historicalSuccess,
        { isCorrect: false, timeTaken: 45 }
      ];

      // Current attempt is the 2nd failure
      const result = await recommendationService.processAdaptiveAttempt({
        question: {
          id: 'q_mixed_test',
          questionText: 'Advanced application of cellular respiration inhibitors',
          difficultyLevel: 'hard'
        },
        concept: {
          id: 'cpt_respiration_inhibition',
          name: 'Respiration Inhibition Dynamics'
        },
        studentAnswer: 'Inhibitors accelerate oxygen consumption',
        correctness: false,
        timeTaken: 50,
        previousAttempts: recentAttempts,
        previousMastery: 88, // Was previously high!
        questionDifficulty: 'hard'
      });

      // 1. Correctness
      expect(result.correctness).toBe(false);

      // 2. Recent performance should significantly pull down mastery despite 5/5 historical start
      expect(result.updatedMastery.masteryScore).toBeLessThan(80);
      expect(result.updatedMastery.consecutiveIncorrect).toBe(2);

      // 3. Difficulty MUST drop: hard -> medium (or lower) to prevent student frustration
      expect(result.recommendedDifficulty).not.toBe('hard');
      expect(['medium', 'easy']).toContain(result.recommendedDifficulty);

      // 4. Reinforcement MUST be required due to recent consecutive failures
      expect(result.reinforcementRequirement.requiresReinforcement).toBe(true);
      expect(result.reinforcementRequirement.pedagogy).toBeDefined();

      // 5. Spoken feedback addresses recent struggle and announces difficulty adjustment
      expect(result.feedback.spokenFeedback).toMatch(/thoughtful effort|simpler way|adjust/i);
    });
  });

  // ==========================================================================
  // 4. Multi-Factor Influences: Time Taken & Difficulty Weighting
  // ==========================================================================
  describe('4. Time Taken & Question Difficulty Weighting', () => {
    it('fluent response (fast & correct) yields higher mastery gain than labored response (slow & correct)', () => {
      const fastResult = masteryService.calculateMasteryUpdate({
        currentScore: 50,
        isCorrect: true,
        timeTaken: 12, // Very fast, fluent
        difficulty: 'medium'
      });

      const slowResult = masteryService.calculateMasteryUpdate({
        currentScore: 50,
        isCorrect: true,
        timeTaken: 85, // Labored, hesitated (> 2x expected time)
        difficulty: 'medium'
      });

      expect(fastResult.masteryScore).toBeGreaterThan(slowResult.masteryScore);
      expect(fastResult.delta).toBeGreaterThan(slowResult.delta);
      expect(slowResult.isFluencyStruggle).toBe(true);
    });

    it('rushed incorrect response (< 25% expected time) is penalized more than thoughtful incorrect response', () => {
      const rushedResult = masteryService.calculateMasteryUpdate({
        currentScore: 70,
        isCorrect: false,
        timeTaken: 4, // Rushed guess
        difficulty: 'medium'
      });

      const thoughtfulResult = masteryService.calculateMasteryUpdate({
        currentScore: 70,
        isCorrect: false,
        timeTaken: 35, // Thoughtful attempt
        difficulty: 'medium'
      });

      expect(rushedResult.masteryScore).toBeLessThan(thoughtfulResult.masteryScore);
      expect(rushedResult.isRushed).toBe(true);
    });

    it('correct on hard question awards more gain than correct on easy question', () => {
      const hardGain = masteryService.calculateMasteryUpdate({
        currentScore: 50,
        isCorrect: true,
        timeTaken: 30,
        difficulty: 'hard'
      });

      const easyGain = masteryService.calculateMasteryUpdate({
        currentScore: 50,
        isCorrect: true,
        timeTaken: 30,
        difficulty: 'easy'
      });

      expect(hardGain.masteryScore).toBeGreaterThan(easyGain.masteryScore);
      expect(hardGain.delta).toBeGreaterThan(easyGain.delta);
    });

    it('incorrect on easy question causes a higher penalty than incorrect on hard question', () => {
      const easyMiss = masteryService.calculateMasteryUpdate({
        currentScore: 70,
        isCorrect: false,
        timeTaken: 30,
        difficulty: 'easy'
      });

      const hardMiss = masteryService.calculateMasteryUpdate({
        currentScore: 70,
        isCorrect: false,
        timeTaken: 30,
        difficulty: 'hard'
      });

      // easy miss should result in lower score (higher loss)
      expect(easyMiss.masteryScore).toBeLessThan(hardMiss.masteryScore);
    });
  });

  // ==========================================================================
  // 5. Snowflake Persistence for Mastery Changes
  // ==========================================================================
  describe('5. Snowflake Persistence', () => {
    it('must persist all mastery modifications and history to Snowflake table CONCEPT_MASTERY', async () => {
      const uniqueUserId = `usr_snowflake_adaptive_${Date.now()}`;
      const uniqueConceptId = `cpt_snow_concept_${Date.now()}`;

      // Attempt 1: Correct
      const res1 = await recommendationService.processAdaptiveAttempt({
        userId: uniqueUserId,
        concept: { id: uniqueConceptId, name: 'Snowflake Managed Concept' },
        question: 'Question 1',
        studentAnswer: 'Correct answer text',
        correctness: true,
        timeTaken: 20,
        questionDifficulty: 'medium'
      });

      expect(res1.updatedMastery.masteryScore).toBeGreaterThan(0);

      // Direct query to Snowflake to verify persistence
      const rows1 = await databaseManager.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ?',
        [uniqueUserId, uniqueConceptId]
      );

      expect(rows1.length).toBe(1);
      expect(parseFloat(rows1[0].MASTERY_SCORE)).toBe(res1.updatedMastery.masteryScore);
      expect(parseInt(rows1[0].ATTEMPTS_COUNT, 10)).toBe(1);

      // Attempt 2: Incorrect
      const res2 = await recommendationService.processAdaptiveAttempt({
        userId: uniqueUserId,
        concept: { id: uniqueConceptId, name: 'Snowflake Managed Concept' },
        question: 'Question 2',
        studentAnswer: 'Wrong answer text',
        correctness: false,
        timeTaken: 40,
        questionDifficulty: 'medium'
      });

      // Verify updated record in Snowflake
      const rows2 = await databaseManager.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ?',
        [uniqueUserId, uniqueConceptId]
      );

      expect(rows2.length).toBe(1);
      expect(parseFloat(rows2[0].MASTERY_SCORE)).toBe(res2.updatedMastery.masteryScore);
      expect(parseInt(rows2[0].ATTEMPTS_COUNT, 10)).toBe(2);
      expect(parseInt(rows2[0].CORRECT_COUNT, 10)).toBe(1);

      // Verify history tracking
      const history = typeof rows2[0].MASTERY_HISTORY === 'string'
        ? JSON.parse(rows2[0].MASTERY_HISTORY)
        : rows2[0].MASTERY_HISTORY;
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
    });
  });

  // ==========================================================================
  // 6. Security: Frontend Mutation Rejection
  // ==========================================================================
  describe('6. Security Guard: Prevent Direct Frontend Mutation', () => {
    it('must reject attempts by client payload to directly mutate mastery scores', async () => {
      await expect(
        recommendationService.processAdaptiveAttempt({
          question: 'Sample question',
          concept: 'Sample concept',
          studentAnswer: 'Any answer',
          correctness: true,
          masteryScore: 100 // Malicious attempt to bypass engine calculation!
        })
      ).rejects.toThrow(/Forbidden: Client is not authorized to directly modify mastery/);

      await expect(
        recommendationService.processAdaptiveAttempt({
          question: 'Sample question',
          concept: 'Sample concept',
          studentAnswer: 'Any answer',
          correctness: true,
          masteryLevel: 'MASTERED' // Malicious attempt to self-promote!
        })
      ).rejects.toThrow(/Forbidden: Client is not authorized to directly modify mastery/);
    });
  });

  // ==========================================================================
  // 7. Canonical Output Structure
  // ==========================================================================
  describe('7. Canonical Output Verification', () => {
    it('should return all required output fields matching the mandated contract', async () => {
      const output = await recommendationService.processAdaptiveAttempt({
        question: {
          id: 'q_contract_check',
          questionText: 'Contract validation question',
          difficultyLevel: 'medium'
        },
        concept: {
          id: 'cpt_contract_check',
          name: 'Contract Concept'
        },
        studentAnswer: 'Student response',
        correctness: true,
        timeTaken: 25,
        questionDifficulty: 'medium'
      });

      // OUTPUT MANDATE:
      // - correctness
      expect(output).toHaveProperty('correctness');
      expect(typeof output.correctness).toBe('boolean');

      // - updated mastery
      expect(output).toHaveProperty('updatedMastery');
      expect(output.updatedMastery).toHaveProperty('masteryScore');
      expect(output.updatedMastery).toHaveProperty('masteryLevel');
      expect(output.updatedMastery).toHaveProperty('recentAccuracy');
      expect(output.updatedMastery).toHaveProperty('historicalAccuracy');

      // - feedback
      expect(output).toHaveProperty('feedback');
      expect(output.feedback).toHaveProperty('spokenFeedback');
      expect(output.feedback).toHaveProperty('screenReaderTranscript');
      expect(output.feedback).toHaveProperty('audioCue');

      // - recommended difficulty
      expect(output).toHaveProperty('recommendedDifficulty');
      expect(['easy', 'medium', 'hard']).toContain(output.recommendedDifficulty);

      // - next question
      expect(output).toHaveProperty('nextQuestion');
      expect(output.nextQuestion).toHaveProperty('questionText');
      expect(output.nextQuestion).toHaveProperty('difficultyLevel');

      // - reinforcement requirement
      expect(output).toHaveProperty('reinforcementRequirement');
      expect(output.reinforcementRequirement).toHaveProperty('requiresReinforcement');
      expect(typeof output.reinforcementRequirement.requiresReinforcement).toBe('boolean');
    });
  });
});
