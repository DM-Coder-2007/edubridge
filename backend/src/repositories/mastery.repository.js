/**
 * EduBridge Adaptive - Mastery Repository (Snowflake)
 *
 * Dedicated data access layer for CONCEPT_MASTERY table in Snowflake.
 * Tracks per-student mastery progression, spaced repetition decay, and learning analytics.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class MasteryRepository {
  /**
   * Upsert student mastery on an individual concept
   * @param {object} masteryData
   * @returns {Promise<object>}
   */
  async upsertMastery({
    userId,
    conceptId,
    masteryScore,
    attemptsCount = 1,
    correctCount = 0,
    consecutiveCorrect = 0,
    masteryLevel = 'NOVICE',
    decayRate = 0.0500,
    historyEntry = null
  }) {
    logger.debug(`[MasteryRepository] Upserting mastery for user ${userId}, concept ${conceptId} (score=${masteryScore})`);

    const existing = await this.findByUserAndConcept(userId, conceptId);

    if (existing) {
      let history = Array.isArray(existing.masteryHistory) ? existing.masteryHistory : [];
      if (historyEntry) {
        history.push({
          ...historyEntry,
          score: masteryScore,
          recordedAt: new Date().toISOString()
        });
      }

      const updates = {
        MASTERY_SCORE: parseFloat(masteryScore),
        ATTEMPTS_COUNT: parseInt(attemptsCount, 10),
        CORRECT_COUNT: parseInt(correctCount, 10),
        CONSECUTIVE_CORRECT: parseInt(consecutiveCorrect, 10),
        MASTERY_LEVEL: masteryLevel,
        DECAY_RATE: parseFloat(decayRate || 0.0500),
        LAST_PRACTICED_AT: new Date().toISOString(),
        MASTERY_HISTORY: JSON.stringify(history)
      };

      await db.update('CONCEPT_MASTERY', updates, 'ID = ?', [existing.id]);
      return this.findByUserAndConcept(userId, conceptId);
    } else {
      const id = uuidv4();
      const initialHistory = historyEntry ? [{
        ...historyEntry,
        score: masteryScore,
        recordedAt: new Date().toISOString()
      }] : [];

      const record = {
        ID: id,
        USER_ID: userId,
        CONCEPT_ID: conceptId,
        MASTERY_SCORE: parseFloat(masteryScore),
        ATTEMPTS_COUNT: parseInt(attemptsCount || 1, 10),
        CORRECT_COUNT: parseInt(correctCount || 0, 10),
        CONSECUTIVE_CORRECT: parseInt(consecutiveCorrect || 0, 10),
        MASTERY_LEVEL: masteryLevel,
        DECAY_RATE: parseFloat(decayRate || 0.0500),
        LAST_PRACTICED_AT: new Date().toISOString(),
        MASTERY_HISTORY: JSON.stringify(initialHistory),
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      };

      await db.insert('CONCEPT_MASTERY', record);
      return this._format(record);
    }
  }

  /**
   * Find mastery record for a specific user and concept
   * @param {string} userId
   * @param {string} conceptId
   * @returns {Promise<object|null>}
   */
  async findByUserAndConcept(userId, conceptId) {
    if (!userId || !conceptId) return null;
    const row = await db.queryOne(
      'SELECT * FROM CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ? LIMIT 1',
      [userId, conceptId]
    );
    return this._format(row);
  }

  /**
   * Find all concept mastery records for a student
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async findAllByUserId(userId) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM CONCEPT_MASTERY WHERE USER_ID = ? ORDER BY MASTERY_SCORE ASC',
      [userId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Find weak concepts needing reinforcement (score < threshold)
   * @param {string} userId
   * @param {number} [threshold=60]
   * @returns {Promise<Array<object>>}
   */
  async getWeakConcepts(userId, threshold = 60) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM CONCEPT_MASTERY WHERE USER_ID = ? AND MASTERY_SCORE < ? ORDER BY MASTERY_SCORE ASC',
      [userId, threshold]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Find concepts successfully mastered by student (score >= threshold)
   * @param {string} userId
   * @param {number} [threshold=85]
   * @returns {Promise<Array<object>>}
   */
  async getMasteredConcepts(userId, threshold = 85) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM CONCEPT_MASTERY WHERE USER_ID = ? AND MASTERY_SCORE >= ? ORDER BY MASTERY_SCORE DESC',
      [userId, threshold]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Delete mastery record by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM CONCEPT_MASTERY WHERE ID = ?', [id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let history = [];
    if (row.MASTERY_HISTORY) {
      try {
        history = typeof row.MASTERY_HISTORY === 'string'
          ? JSON.parse(row.MASTERY_HISTORY)
          : row.MASTERY_HISTORY;
      } catch {
        history = [];
      }
    }

    return {
      id: row.ID,
      userId: row.USER_ID,
      conceptId: row.CONCEPT_ID,
      masteryScore: parseFloat(row.MASTERY_SCORE || 0.0),
      attemptsCount: parseInt(row.ATTEMPTS_COUNT || 0, 10),
      correctCount: parseInt(row.CORRECT_COUNT || 0, 10),
      consecutiveCorrect: parseInt(row.CONSECUTIVE_CORRECT || 0, 10),
      masteryLevel: row.MASTERY_LEVEL || 'NOVICE',
      decayRate: parseFloat(row.DECAY_RATE || 0.0500),
      lastPracticedAt: row.LAST_PRACTICED_AT,
      masteryHistory: history,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const masteryRepository = new MasteryRepository();
module.exports = masteryRepository;
