/**
 * EduBridge Adaptive - Attempt Repository (Snowflake)
 *
 * Dedicated data access layer for ATTEMPTS table in Snowflake.
 * Tracks student quiz sessions, faster-whisper transcripts, and Gemini answer evaluations.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class AttemptRepository {
  /**
   * Create a new quiz attempt session in Snowflake
   * @param {object} attemptData
   * @returns {Promise<object>}
   */
  async createAttempt({
    userId,
    lessonId,
    totalQuestions = 0,
    status = 'IN_PROGRESS'
  }) {
    const id = uuidv4();
    const record = {
      ID: id,
      USER_ID: userId,
      LESSON_ID: lessonId,
      TOTAL_QUESTIONS: parseInt(totalQuestions || 0, 10),
      CORRECT_QUESTIONS: 0,
      SCORE_PERCENTAGE: 0.0,
      TIME_SPENT_SECONDS: 0,
      STATUS: status,
      ERROR_MESSAGE: null,
      FEEDBACK_AUDIO_URL: null,
      ANSWERS_SUMMARY: JSON.stringify([]),
      AI_EVALUATION_METADATA: JSON.stringify({}),
      STARTED_AT: new Date().toISOString(),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[AttemptRepository] Starting assessment attempt for user ${userId}, lesson ${lessonId} (${id})`);
    await db.insert('ATTEMPTS', record);
    return this._format(record);
  }

  /**
   * Find attempt by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM ATTEMPTS WHERE ID = ? LIMIT 1', [id]);
    return this._format(row);
  }

  /**
   * Find all attempts by a user ordered by recency
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async findByUserId(userId) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM ATTEMPTS WHERE USER_ID = ? ORDER BY STARTED_AT DESC',
      [userId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Find attempts by user and lesson
   * @param {string} userId
   * @param {string} lessonId
   * @returns {Promise<Array<object>>}
   */
  async findByLessonId(userId, lessonId) {
    if (!userId || !lessonId) return [];
    const rows = await db.query(
      'SELECT * FROM ATTEMPTS WHERE USER_ID = ? AND LESSON_ID = ? ORDER BY STARTED_AT DESC',
      [userId, lessonId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Append a student answer (text or voice) to the attempt summary
   * @param {string} attemptId
   * @param {object} answerEntry
   * @returns {Promise<object|null>}
   */
  async recordAnswer(attemptId, {
    questionId,
    studentAnswer,
    isCorrect,
    score = 0,
    timeTakenSeconds = 0,
    transcript = null,
    confidence = null,
    aiFeedback = null
  }) {
    const attempt = await this.findById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt with ID "${attemptId}" not found.`);
    }

    const currentSummary = Array.isArray(attempt.answersSummary) ? attempt.answersSummary : [];
    const newEntry = {
      questionId,
      studentAnswer,
      isCorrect: Boolean(isCorrect),
      score: parseFloat(score || (isCorrect ? 100 : 0)),
      timeTakenSeconds: parseInt(timeTakenSeconds || 0, 10),
      transcript,
      confidence,
      aiFeedback,
      recordedAt: new Date().toISOString()
    };

    currentSummary.push(newEntry);

    const correctCount = currentSummary.filter(a => a.isCorrect).length;
    const totalCount = currentSummary.length;
    const scorePct = totalCount > 0 ? (correctCount / totalCount) * 100 : 0.0;
    const totalTime = currentSummary.reduce((acc, a) => acc + (a.timeTakenSeconds || 0), 0);

    const updates = {
      TOTAL_QUESTIONS: totalCount,
      CORRECT_QUESTIONS: correctCount,
      SCORE_PERCENTAGE: parseFloat(scorePct.toFixed(2)),
      TIME_SPENT_SECONDS: totalTime,
      ANSWERS_SUMMARY: JSON.stringify(currentSummary)
    };

    await db.update('ATTEMPTS', updates, 'ID = ?', [attemptId]);
    return this.findById(attemptId);
  }

  /**
   * Finalize attempt and mark as COMPLETED
   * @param {string} attemptId
   * @param {object} completionData
   * @returns {Promise<object|null>}
   */
  async completeAttempt(attemptId, {
    totalQuestions,
    correctQuestions,
    scorePercentage,
    timeSpentSeconds,
    answersSummary,
    feedbackAudioUrl = null,
    aiEvaluationMetadata = {}
  }) {
    const updates = {
      STATUS: 'COMPLETED',
      COMPLETED_AT: new Date().toISOString()
    };

    if (totalQuestions !== undefined) updates.TOTAL_QUESTIONS = parseInt(totalQuestions, 10);
    if (correctQuestions !== undefined) updates.CORRECT_QUESTIONS = parseInt(correctQuestions, 10);
    if (scorePercentage !== undefined) updates.SCORE_PERCENTAGE = parseFloat(scorePercentage);
    if (timeSpentSeconds !== undefined) updates.TIME_SPENT_SECONDS = parseInt(timeSpentSeconds, 10);
    if (answersSummary) {
      updates.ANSWERS_SUMMARY = typeof answersSummary === 'string'
        ? answersSummary
        : JSON.stringify(answersSummary);
    }
    if (feedbackAudioUrl) updates.FEEDBACK_AUDIO_URL = feedbackAudioUrl;
    if (aiEvaluationMetadata) {
      updates.AI_EVALUATION_METADATA = typeof aiEvaluationMetadata === 'string'
        ? aiEvaluationMetadata
        : JSON.stringify(aiEvaluationMetadata);
    }

    await db.update('ATTEMPTS', updates, 'ID = ?', [attemptId]);
    return this.findById(attemptId);
  }

  /**
   * Update attempt lifecycle status
   * @param {string} attemptId
   * @param {string} status
   * @param {string|null} [errorMessage=null]
   * @returns {Promise<object|null>}
   */
  async updateStatus(attemptId, status, errorMessage = null) {
    const updates = { STATUS: status };
    if (errorMessage !== undefined) updates.ERROR_MESSAGE = errorMessage;
    await db.update('ATTEMPTS', updates, 'ID = ?', [attemptId]);
    return this.findById(attemptId);
  }

  /**
   * Delete attempt by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM ATTEMPTS WHERE ID = ?', [id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let summary = [];
    if (row.ANSWERS_SUMMARY) {
      try {
        summary = typeof row.ANSWERS_SUMMARY === 'string'
          ? JSON.parse(row.ANSWERS_SUMMARY)
          : row.ANSWERS_SUMMARY;
      } catch {
        summary = [];
      }
    }

    let aiMeta = {};
    if (row.AI_EVALUATION_METADATA) {
      try {
        aiMeta = typeof row.AI_EVALUATION_METADATA === 'string'
          ? JSON.parse(row.AI_EVALUATION_METADATA)
          : row.AI_EVALUATION_METADATA;
      } catch {
        aiMeta = {};
      }
    }

    return {
      id: row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID,
      totalQuestions: parseInt(row.TOTAL_QUESTIONS || 0, 10),
      correctQuestions: parseInt(row.CORRECT_QUESTIONS || 0, 10),
      scorePercentage: parseFloat(row.SCORE_PERCENTAGE || 0.0),
      timeSpentSeconds: parseInt(row.TIME_SPENT_SECONDS || 0, 10),
      status: row.STATUS,
      errorMessage: row.ERROR_MESSAGE,
      feedbackAudioUrl: row.FEEDBACK_AUDIO_URL,
      answersSummary: summary,
      aiEvaluationMetadata: aiMeta,
      startedAt: row.STARTED_AT,
      completedAt: row.COMPLETED_AT,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const attemptRepository = new AttemptRepository();
module.exports = attemptRepository;
