/**
 * EduBridge Adaptive - Dynamic Next Question Service
 *
 * Selects or generates the next optimal learning challenge:
 * 1. Checks Snowflake QUESTIONS table for available questions in lesson
 * 2. Filters out previously answered questions in the current attempt
 * 3. Targets student's identified weak concepts and recommended difficulty
 * 4. Synthesizes an on-the-fly adaptive follow-up question via Gemini if no match exists
 * 5. Persists dynamically generated questions into Snowflake for continuous reuse
 */

const quizRepository = require('../../repositories/quizRepository');
const generationService = require('../../integrations/gemini/generation.service');
const difficultyService = require('./difficulty.service');
const masteryService = require('./mastery.service');
const logger = require('../../utils/logger');

class NextQuestionService {
  /**
   * Select or generate the next adaptive question for a student
   *
   * @param {object} params
   * @param {string} params.userId - Student user ID
   * @param {string} params.lessonId - Lesson ID
   * @param {string} [params.attemptId] - Current quiz attempt ID
   * @param {string} [params.targetDifficulty='medium'] - Target difficulty level
   * @param {string[]} [params.weakConcepts=[]] - Array of weak concept names or IDs
   * @param {string} [params.lastMisconception] - Student's previous misconception/wrong answer
   * @param {string[]} [params.excludeQuestionIds=[]] - Question IDs already asked
   * @returns {Promise<object>} Selected or generated question
   */
  async selectOrGenerateNextQuestion({
    userId,
    lessonId,
    attemptId = null,
    targetDifficulty = 'medium',
    weakConcepts = [],
    lastMisconception = null,
    excludeQuestionIds = []
  }) {
    if (!lessonId) {
      throw new Error('lessonId is required to determine next question.');
    }

    const normalizedDifficulty = difficultyService.normalizeDifficulty(targetDifficulty);
    const excludedIds = new Set(excludeQuestionIds);

    // 1. If an attemptId is provided, fetch already answered question IDs
    if (attemptId) {
      try {
        const answers = await quizRepository.findAnswersByAttemptId(attemptId);
        for (const ans of answers) {
          if (ans.questionId) {
            excludedIds.add(ans.questionId);
          }
        }
      } catch (err) {
        logger.warn(`[NextQuestionService] Could not fetch previous answers for attempt ${attemptId}:`, err.message);
      }
    }

    // 2. Fetch existing questions for this lesson from Snowflake
    const existingQuestions = await quizRepository.findQuestionsByLessonId(lessonId);
    const available = existingQuestions.filter(q => !excludedIds.has(q.id));

    logger.info(
      `[NextQuestionService] Lesson ${lessonId}: ${available.length} available out of ${existingQuestions.length} total questions.`
    );

    // 3. Strategy A: Look for matching weak concept questions
    if (weakConcepts.length > 0 && available.length > 0) {
      const weakConceptMatch = available.find(q => {
        const matchesConcept = weakConcepts.some(
          wc => (q.conceptId && q.conceptId.toLowerCase() === wc.toLowerCase()) ||
                (q.questionText && q.questionText.toLowerCase().includes(wc.toLowerCase()))
        );
        const matchesDiff = difficultyService.normalizeDifficulty(q.difficultyLevel) === normalizedDifficulty;
        return matchesConcept && matchesDiff;
      });

      if (weakConceptMatch) {
        logger.info(`[NextQuestionService] Found existing concept-matched question: ${weakConceptMatch.id}`);
        return {
          ...weakConceptMatch,
          selectionStrategy: 'WEAK_CONCEPT_MATCH',
          isDynamicallyGenerated: false
        };
      }
    }

    // 4. Strategy B: Look for matching difficulty questions in this lesson
    if (available.length > 0) {
      const difficultyMatch = available.find(
        q => difficultyService.normalizeDifficulty(q.difficultyLevel) === normalizedDifficulty
      );

      if (difficultyMatch) {
        logger.info(`[NextQuestionService] Found existing difficulty-matched question: ${difficultyMatch.id}`);
        return {
          ...difficultyMatch,
          selectionStrategy: 'DIFFICULTY_MATCH',
          isDynamicallyGenerated: false
        };
      }

      // Any available question if exact difficulty not found
      logger.info(`[NextQuestionService] Returning first available question: ${available[0].id}`);
      return {
        ...available[0],
        selectionStrategy: 'FALLBACK_AVAILABLE',
        isDynamicallyGenerated: false
      };
    }

    // 5. Strategy C: All pre-generated questions exhausted or targeted remediation required!
    // Dynamically synthesize a new adaptive follow-up question via Gemini
    logger.info(`[NextQuestionService] All questions exhausted for lesson ${lessonId}. Synthesizing adaptive question...`);

    const targetWeakConcept = weakConcepts[0] || 'Core Curriculum Concept';
    const generatedQuestion = await generationService.generateFollowupQuestion({
      weakConcept: targetWeakConcept,
      misconception: lastMisconception || 'Prior incorrect response',
      difficulty: normalizedDifficulty,
      entityId: `adaptive_q_${lessonId}`
    });

    // 6. Persist newly generated adaptive question to Snowflake QUESTIONS table
    const persisted = await quizRepository.createQuestion({
      lessonId,
      conceptId: generatedQuestion.conceptId || null,
      questionText: generatedQuestion.questionText,
      questionType: generatedQuestion.questionType || 'MULTIPLE_CHOICE',
      options: generatedQuestion.options || [],
      correctAnswer: generatedQuestion.correctAnswer,
      explanation: generatedQuestion.explanation,
      audioPromptHint: generatedQuestion.audioPromptHint,
      difficultyLevel: normalizedDifficulty,
      orderIndex: existingQuestions.length + 1
    });

    logger.info(`[NextQuestionService] Persisted new adaptive question to Snowflake: ${persisted.id}`);

    return {
      ...persisted,
      selectionStrategy: 'AI_SYNTHESIZED_REMEDIATION',
      isDynamicallyGenerated: true
    };
  }
}

const nextQuestionService = new NextQuestionService();
module.exports = nextQuestionService;
