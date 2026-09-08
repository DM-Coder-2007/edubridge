/**
 * EduBridge Adaptive - Question Repository (Snowflake)
 *
 * Dedicated data access layer for QUESTIONS table in Snowflake.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class QuestionRepository {
  /**
   * Create a single assessment question in Snowflake
   * @param {object} questionData
   * @returns {Promise<object>}
   */
  async create({
    lessonId,
    conceptId = null,
    questionText,
    questionType = 'MULTIPLE_CHOICE',
    options = [],
    correctAnswer,
    explanation,
    audioPromptHint = null,
    audioPromptUrl = null,
    adaptiveRubric = null,
    difficultyLevel = 'medium',
    orderIndex = 0
  }) {
    const id = uuidv4();
    const record = {
      ID: id,
      QUESTION_ID: id,
      LESSON_ID: lessonId,
      CONCEPT_ID: conceptId,
      QUESTION_TEXT: questionText,
      QUESTION_TYPE: questionType,
      OPTIONS: typeof options === 'string' ? options : JSON.stringify(options),
      CORRECT_ANSWER: String(correctAnswer),
      EXPLANATION: explanation || '',
      AUDIO_PROMPT_HINT: audioPromptHint,
      AUDIO_PROMPT_URL: audioPromptUrl,
      ADAPTIVE_RUBRIC: typeof adaptiveRubric === 'string'
        ? adaptiveRubric
        : (adaptiveRubric ? JSON.stringify(adaptiveRubric) : null),
      DIFFICULTY_LEVEL: difficultyLevel,
      DIFFICULTY: difficultyLevel,
      ORDER_INDEX: parseInt(orderIndex || 0, 10),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[QuestionRepository] Inserting question for lesson ${lessonId} (${id})`);
    await db.insert('QUESTIONS', record);
    return this._format(record);
  }

  /**
   * Batch insert multiple questions for a lesson
   * @param {Array<object>} questions
   * @returns {Promise<Array<object>>}
   */
  async createMany(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return [];
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const created = await this.create({
        ...q,
        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
      });
      results.push(created);
    }
    return results;
  }

  /**
   * Find question by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE ID = ? OR QUESTION_ID = ? LIMIT 1', [id, id]);
    return this._format(row);
  }

  /**
   * Find all questions belonging to a lesson ordered by sequence index
   * @param {string} lessonId
   * @returns {Promise<Array<object>>}
   */
  async findByLessonId(lessonId) {
    if (!lessonId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE LESSON_ID = ? ORDER BY ORDER_INDEX ASC, CREATED_AT ASC',
      [lessonId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Find questions tagged to a specific concept
   * @param {string} conceptId
   * @returns {Promise<Array<object>>}
   */
  async findByConceptId(conceptId) {
    if (!conceptId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE CONCEPT_ID = ? ORDER BY CREATED_AT ASC',
      [conceptId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Find questions by lesson and difficulty level
   * @param {string} lessonId
   * @param {string} difficultyLevel - 'easy', 'medium', 'hard'
   * @returns {Promise<Array<object>>}
   */
  async findByDifficulty(lessonId, difficultyLevel) {
    if (!lessonId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE LESSON_ID = ? AND (DIFFICULTY_LEVEL = ? OR DIFFICULTY = ?) ORDER BY ORDER_INDEX ASC',
      [lessonId, difficultyLevel, difficultyLevel]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Update audio narration prompt hint and URL
   * @param {string} id
   * @param {object} fields
   * @returns {Promise<object|null>}
   */
  async updateAudioPrompt(id, { audioPromptUrl, audioPromptHint }) {
    const updates = {};
    if (audioPromptUrl !== undefined) updates.AUDIO_PROMPT_URL = audioPromptUrl;
    if (audioPromptHint !== undefined) updates.AUDIO_PROMPT_HINT = audioPromptHint;

    if (Object.keys(updates).length > 0) {
      await db.update('QUESTIONS', updates, 'ID = ? OR QUESTION_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Delete question by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE ID = ? OR QUESTION_ID = ?', [id, id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let parsedOptions = [];
    if (row.OPTIONS) {
      try {
        parsedOptions = typeof row.OPTIONS === 'string'
          ? JSON.parse(row.OPTIONS)
          : row.OPTIONS;
      } catch {
        parsedOptions = [];
      }
    }

    let rubric = null;
    if (row.ADAPTIVE_RUBRIC) {
      try {
        rubric = typeof row.ADAPTIVE_RUBRIC === 'string'
          ? JSON.parse(row.ADAPTIVE_RUBRIC)
          : row.ADAPTIVE_RUBRIC;
      } catch {
        rubric = null;
      }
    }

    return {
      id: row.ID || row.QUESTION_ID,
      questionId: row.QUESTION_ID || row.ID,
      lessonId: row.LESSON_ID,
      conceptId: row.CONCEPT_ID,
      questionText: row.QUESTION_TEXT,
      questionType: row.QUESTION_TYPE,
      options: parsedOptions,
      correctAnswer: row.CORRECT_ANSWER,
      explanation: row.EXPLANATION,
      audioPromptHint: row.AUDIO_PROMPT_HINT,
      audioPromptUrl: row.AUDIO_PROMPT_URL,
      adaptiveRubric: rubric,
      difficultyLevel: row.DIFFICULTY_LEVEL || row.DIFFICULTY,
      orderIndex: parseInt(row.ORDER_INDEX || 0, 10),
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const questionRepository = new QuestionRepository();
module.exports = questionRepository;
