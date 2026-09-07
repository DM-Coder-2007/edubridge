/**
 * EduBridge Adaptive - Adaptive Recommendation Service
 *
 * Master orchestrator for the adaptive learning engine:
 * Coordinates:
 * 1. Cognitive mastery calculation & Snowflake persistence (masteryService)
 * 2. Multi-factor difficulty progression (difficultyService)
 * 3. Sensory reinforcement & pedagogical scaffolding (reinforcementService)
 * 4. Audio-first feedback & screen reader narration (feedbackService)
 * 5. Dynamic next question selection & synthesis (nextQuestionService)
 *
 * CRITICAL RULE:
 * Frontend is never allowed to directly manipulate mastery scores.
 * All mastery progression is computed server-side from verifiable assessment attempts.
 */

const masteryService = require('./mastery.service');
const difficultyService = require('./difficulty.service');
const reinforcementService = require('./reinforcement.service');
const feedbackService = require('./feedback.service');
const nextQuestionService = require('./nextQuestion.service');
const logger = require('../../utils/logger');

class RecommendationService {
  /**
   * Process an adaptive learning attempt and generate the next pedagogical steps
   *
   * @param {object} params
   * @param {object|string} params.question - Current question record or description
   * @param {object|string} params.concept - Target concept record or description
   * @param {string} params.studentAnswer - Student's typed or voice-recognized response
   * @param {boolean} [params.correctness] - Answer correctness (alias for isCorrect)
   * @param {boolean} [params.isCorrect] - Answer correctness
   * @param {number} [params.timeTaken=30] - Elapsed response time in seconds
   * @param {Array<object>|number} [params.previousAttempts=[]] - History of attempts or attempt count
   * @param {number|object} [params.previousMastery] - Prior mastery score (0-100) or record
   * @param {string} [params.questionDifficulty] - Difficulty level ('easy', 'medium', 'hard')
   * @param {string} [params.userId] - Student ID for Snowflake persistence
   * @param {string} [params.lessonId] - Lesson ID for question selection
   * @param {string} [params.attemptId] - Current quiz session attempt ID
   * @returns {Promise<{ correctness: boolean, updatedMastery: object, feedback: object, recommendedDifficulty: string, nextQuestion: object, reinforcementRequirement: object }>}
   */
  async processAdaptiveAttempt(params) {
    // 1. Security Check: Block direct client manipulation of mastery
    masteryService.assertClientCannotMutateMastery(params);

    const {
      question,
      concept,
      studentAnswer = '',
      timeTaken = 30,
      previousAttempts = [],
      previousMastery = null,
      questionDifficulty = null,
      userId = null,
      lessonId = null,
      attemptId = null
    } = params;

    // Normalize correctness
    const isCorrect = params.correctness !== undefined ? Boolean(params.correctness) : Boolean(params.isCorrect);

    // Normalize question object
    const qObj = typeof question === 'object' && question !== null ? question : { questionText: String(question || '') };
    const difficultyLevel = difficultyService.normalizeDifficulty(
      questionDifficulty || qObj.difficultyLevel || 'medium'
    );

    // Normalize concept object
    const cObj = typeof concept === 'object' && concept !== null
      ? concept
      : { id: 'cpt_general', name: String(concept || 'Core Concept') };
    const conceptId = cObj.id || qObj.conceptId || 'cpt_general';
    const conceptName = cObj.name || 'Core Curriculum Concept';

    logger.info(
      `[RecommendationService] Processing attempt: user=${userId}, concept=${conceptName}, isCorrect=${isCorrect}, time=${timeTaken}s, diff=${difficultyLevel}`
    );

    // 2. Compute Updated Mastery & Persist to Snowflake
    let updatedMastery;

    if (userId) {
      // If student is authenticated, update and persist to Snowflake CONCEPT_MASTERY
      updatedMastery = await masteryService.recordConceptAttempt({
        userId,
        conceptId,
        isCorrect,
        timeTaken,
        difficulty: difficultyLevel,
        conceptName
      });
    } else {
      // Pure calculation mode (e.g. deterministic unit tests without DB or guest practice)
      const prevScore = typeof previousMastery === 'number'
        ? previousMastery
        : (previousMastery?.masteryScore || 0);

      const prevAttemptsList = Array.isArray(previousAttempts)
        ? previousAttempts
        : [];

      const attemptsCount = typeof previousAttempts === 'number'
        ? previousAttempts
        : prevAttemptsList.length;

      const correctCount = prevAttemptsList.filter(a => a.isCorrect).length;

      let consecutiveCorrect = 0;
      let consecutiveIncorrect = 0;
      for (let i = prevAttemptsList.length - 1; i >= 0; i--) {
        if (prevAttemptsList[i].isCorrect) {
          if (consecutiveIncorrect === 0) consecutiveCorrect++;
        } else {
          if (consecutiveCorrect === 0) consecutiveIncorrect++;
        }
      }

      updatedMastery = masteryService.calculateMasteryUpdate({
        currentScore: prevScore,
        previousAttempts: prevAttemptsList,
        consecutiveCorrect,
        consecutiveIncorrect,
        attemptsCount,
        correctCount,
        isCorrect,
        timeTaken,
        difficulty: difficultyLevel
      });
    }

    // 3. Multi-Factor Difficulty Determination
    const difficultyProgression = difficultyService.determineNextDifficulty({
      currentDifficulty: difficultyLevel,
      isCorrect,
      score: updatedMastery.masteryScore,
      timeTaken,
      consecutiveCorrect: updatedMastery.consecutiveCorrect,
      consecutiveIncorrect: updatedMastery.consecutiveIncorrect,
      recentAccuracy: updatedMastery.recentAccuracy,
      historicalAccuracy: updatedMastery.historicalAccuracy,
      masteryScore: updatedMastery.masteryScore
    });

    const recommendedDifficulty = difficultyProgression.nextDifficulty;

    // 4. Reinforcement Requirement Evaluation
    const reinforcementEval = reinforcementService.evaluateReinforcementRequirement({
      isCorrect,
      masteryScore: updatedMastery.masteryScore,
      recentAccuracy: updatedMastery.recentAccuracy,
      historicalAccuracy: updatedMastery.historicalAccuracy,
      consecutiveIncorrect: updatedMastery.consecutiveIncorrect,
      consecutiveCorrect: updatedMastery.consecutiveCorrect,
      timeTaken,
      difficulty: difficultyLevel
    });

    // Build reinforcement content if needed
    let reinforcementContent = null;
    if (reinforcementEval.requiresReinforcement) {
      reinforcementContent = await reinforcementService.buildReinforcementContent({
        concept: cObj,
        studentMisconception: studentAnswer,
        reinforcementType: reinforcementEval.reinforcementType,
        invokeAi: false // default to fast deterministic scaffolding
      });
    }

    const reinforcementRequirement = {
      ...reinforcementEval,
      content: reinforcementContent
    };

    // 5. Formulate Audio-First Adaptive Feedback
    const isWeakConcept = !isCorrect || updatedMastery.masteryScore < 60 || reinforcementEval.requiresReinforcement;
    const isStrongConcept = isCorrect && updatedMastery.masteryScore >= 85;

    let spokenText = '';
    let screenReaderText = '';
    const audioCue = isCorrect
      ? (updatedMastery.masteryScore >= 85 ? '[Audio Cue: bright chime]' : '[Audio Cue: rising tone]')
      : '[Audio Cue: gentle low bell]';

    if (isCorrect) {
      spokenText = `${audioCue} That is correct!`;
      if (isStrongConcept) {
        spokenText += ` Outstanding mastery of ${conceptName}. You are ready for advanced applications!`;
      } else {
        spokenText += ` You are building steady proficiency with ${conceptName}.`;
      }
      if (difficultyProgression.voiceAnnouncement) {
        spokenText += ` ${difficultyProgression.voiceAnnouncement}`;
      }

      screenReaderText = `${audioCue} Result: Correct.\nConcept: ${conceptName}.\nMastery Level: ${updatedMastery.masteryLevel} (${updatedMastery.masteryScore}%).`;
    } else {
      spokenText = `${audioCue} That was a thoughtful effort, but not quite correct.`;
      if (reinforcementContent?.simplerExplanation) {
        spokenText += ` Let's look at a simpler way to think about it: ${reinforcementContent.simplerExplanation}`;
      }
      if (reinforcementContent?.tactileAnalogy) {
        spokenText += ` Tactile picture: ${reinforcementContent.tactileAnalogy}`;
      }
      if (difficultyProgression.voiceAnnouncement) {
        spokenText += ` ${difficultyProgression.voiceAnnouncement}`;
      }

      screenReaderText = `${audioCue} Result: Needs Review.\nConcept: ${conceptName}.\nTarget Difficulty: ${recommendedDifficulty}.\nTactile Analogy: ${reinforcementContent?.tactileAnalogy || 'Think of a protective outer frame.'}`;
    }

    const feedback = {
      isCorrect,
      audioCue,
      spokenFeedback: spokenText.trim(),
      screenReaderTranscript: screenReaderText.trim(),
      sensoryAnalogy: reinforcementContent?.tactileAnalogy || cObj.simplifiedAnalogy || null,
      simplerExplanation: isWeakConcept ? (reinforcementContent?.simplerExplanation || null) : null,
      advancedExplanation: isStrongConcept ? `Advanced application analysis for ${conceptName}` : null
    };

    // 6. Next Question Selection / Synthesis
    let nextQ;
    if (lessonId) {
      nextQ = await nextQuestionService.selectOrGenerateNextQuestion({
        userId: userId || 'test_user',
        lessonId,
        attemptId,
        targetDifficulty: recommendedDifficulty,
        weakConcepts: isWeakConcept ? [conceptId, conceptName] : [],
        lastMisconception: !isCorrect ? studentAnswer : null
      });
    } else {
      // Deterministic synthetic question descriptor when lessonId is omitted
      nextQ = {
        questionText: isWeakConcept
          ? `Foundational question reinforcing ${conceptName}`
          : (isStrongConcept ? `Advanced application challenge on ${conceptName}` : `Practice question on ${conceptName}`),
        questionType: 'MULTIPLE_CHOICE',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: `Step-by-step resolution for ${conceptName}.`,
        audioPromptHint: 'Say option 1, 2, 3, or 4.',
        difficultyLevel: recommendedDifficulty,
        conceptId,
        isDynamicallyGenerated: false
      };
    }

    return {
      correctness: isCorrect,
      updatedMastery: {
        masteryScore: updatedMastery.masteryScore,
        masteryLevel: updatedMastery.masteryLevel,
        delta: updatedMastery.delta,
        recentAccuracy: updatedMastery.recentAccuracy,
        historicalAccuracy: updatedMastery.historicalAccuracy,
        consecutiveCorrect: updatedMastery.consecutiveCorrect,
        consecutiveIncorrect: updatedMastery.consecutiveIncorrect,
        lastPracticedAt: updatedMastery.lastPracticedAt || new Date().toISOString()
      },
      feedback,
      recommendedDifficulty,
      nextQuestion: nextQ,
      reinforcementRequirement
    };
  }
}

const recommendationService = new RecommendationService();
module.exports = recommendationService;
