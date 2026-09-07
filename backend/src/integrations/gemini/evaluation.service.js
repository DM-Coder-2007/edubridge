/**
 * EduBridge Adaptive - Gemini Answer Evaluation Service
 *
 * Implements schema-validated student answer evaluation:
 * 1. Evaluates multiple-choice, open-ended, and voice transcript responses
 * 2. Compares against correct answers, pedagogical explanations, and core concepts
 * 3. Identifies specific misconceptions and struggling concepts
 * 4. Recommends difficulty progression (easy, medium, hard)
 * 5. Generates conversational, audio-first feedback tailored for visually impaired students
 *
 * RESILIENCE & SECURITY:
 * - Never blindly trusts model JSON
 * - Retries safely up to maxRetries on malformed outputs with repair prompts
 * - Marks operations FAILED if validation consistently fails
 * - Persists diagnostic metrics (model, timestamp, operation, duration, retry count, status)
 * - Zero API key leakage
 */

const client = require('./client');
const prompts = require('./prompts');
const schemas = require('./schemas');
const aiMetadataRepository = require('../../repositories/aiMetadataRepository');
const logger = require('../../utils/logger');

class GeminiEvaluationService {
  constructor() {
    this.maxRetries = 2;
  }

  /**
   * Internal resilient evaluation wrapper with automatic retry on malformed JSON
   * @private
   */
  async _executeWithSchemaValidation({ prompt, operation = 'ANSWER_EVALUATION', validator, entityId = 'eval_task' }) {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError = null;
    let activePrompt = prompt;

    while (retryCount <= this.maxRetries) {
      try {
        logger.info(`[GeminiEvaluation] Running ${operation} (Attempt #${retryCount + 1})`);

        const response = await client.generateContent(activePrompt, { operation });
        const parsed = schemas.cleanAndParseJson(response.text);

        // Validate strictly against canonical schema
        validator(parsed);

        const durationMs = Date.now() - startTime;

        // Record successful AI metadata
        await this._recordMetadata({
          operation,
          entityId,
          durationMs,
          status: 'SUCCESS',
          retryCount,
          rawResponse: parsed,
          promptPreview: typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
        });

        logger.info(`[GeminiEvaluation] ${operation} successfully validated in ${durationMs}ms`);
        return parsed;
      } catch (err) {
        lastError = err;
        retryCount++;

        logger.warn(`[GeminiEvaluation] ${operation} attempt #${retryCount} failed validation: ${err.message}`);

        if (retryCount <= this.maxRetries) {
          // Construct repair prompt for safe retry
          activePrompt = `${prompt}\n\nIMPORTANT: The previous output failed validation with error: "${err.message}". You MUST return ONLY valid, parseable JSON conforming exactly to the required schema: { "isCorrect": boolean, "score": number, "feedback": string, "weakConcepts": string[], "recommendedNextDifficulty": string, "followupQuestion": string|null }. No conversational text.`;
        }
      }
    }

    // All retries exhausted: mark operation FAILED and record diagnostic context
    const durationMs = Date.now() - startTime;
    await this._recordMetadata({
      operation,
      entityId,
      durationMs,
      status: 'FAILED',
      retryCount: retryCount - 1,
      errorMessage: lastError.message,
      promptPreview: typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
    });

    logger.error(`[GeminiEvaluation] ${operation} permanently failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
    throw new Error(`AI answer evaluation failed: ${lastError.message}`);
  }

  /**
   * Record AI evaluation metadata in Snowflake
   * @private
   */
  async _recordMetadata({ operation, entityId, durationMs, status, retryCount, errorMessage = null, rawResponse = null, promptPreview = '' }) {
    try {
      await aiMetadataRepository.record({
        entityType: operation,
        entityId: entityId || 'eval_task',
        modelName: client.getModelName(),
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        latencyMs: durationMs,
        promptPreview: promptPreview.substring(0, 500),
        rawResponse: {
          generationTimestamp: new Date().toISOString(),
          operation,
          status,
          processingDurationMs: durationMs,
          retryCount,
          errorMessage,
          responseSnippet: rawResponse ? JSON.stringify(rawResponse).substring(0, 500) : null
        }
      });
    } catch {
      // Non-blocking logging failure
    }
  }

  /**
   * Evaluate a student's answer (text or voice transcript) against a question
   *
   * @param {object} params
   * @param {string} params.questionText - The question presented to the student
   * @param {string} params.correctAnswer - The verified correct answer
   * @param {string} [params.explanation] - Pedagogical explanation
   * @param {string} params.studentAnswer - The student's typed or speech-recognized answer
   * @param {string} [params.conceptName] - Target curriculum concept
   * @param {string} [params.entityId] - Tracking entity ID (e.g. attempt ID or question ID)
   * @returns {Promise<{ isCorrect: boolean, score: number, feedback: string, weakConcepts: string[], recommendedNextDifficulty: string, followupQuestion: string|null }>}
   */
  async evaluateStudentAnswer({
    questionText,
    correctAnswer,
    explanation = '',
    studentAnswer = '',
    conceptName = '',
    entityId
  }) {
    if (!questionText || typeof questionText !== 'string') {
      throw new Error('Question text is required for evaluation.');
    }
    if (correctAnswer === undefined || correctAnswer === null) {
      throw new Error('Correct answer is required for evaluation.');
    }

    const trimmedAnswer = typeof studentAnswer === 'string' ? studentAnswer.trim() : String(studentAnswer || '');

    // Handle empty student response gracefully without wasting API calls
    if (!trimmedAnswer) {
      return {
        isCorrect: false,
        score: 0,
        feedback: "No answer was detected. You can speak your answer clearly or type it into the response field.",
        weakConcepts: conceptName ? [conceptName] : [],
        recommendedNextDifficulty: 'easy',
        followupQuestion: null
      };
    }

    const prompt = prompts.answerEvaluation({
      questionText,
      correctAnswer: String(correctAnswer),
      explanation: explanation || 'Refer to the core lesson concept.',
      studentAnswer: trimmedAnswer,
      conceptName: conceptName || 'Key Educational Concept'
    });

    const evaluated = await this._executeWithSchemaValidation({
      prompt,
      operation: 'ANSWER_EVALUATION',
      validator: schemas.validateEvaluationResponse,
      entityId: entityId || `eval_${Date.now()}`
    });

    return evaluated;
  }

  /**
   * Batch evaluate multiple answers (e.g. for a completed quiz attempt)
   *
   * @param {Array<{ questionText: string, correctAnswer: string, explanation: string, studentAnswer: string, conceptName?: string, entityId?: string }>} answers
   * @returns {Promise<Array<object>>}
   */
  async evaluateBatch(answers) {
    if (!Array.isArray(answers)) {
      throw new Error('Answers must be an array for batch evaluation.');
    }

    const results = [];
    for (const item of answers) {
      const evaluation = await this.evaluateStudentAnswer(item);
      results.push({
        ...evaluation,
        questionId: item.questionId || item.entityId
      });
    }

    return results;
  }
}

const evaluationService = new GeminiEvaluationService();
module.exports = evaluationService;
