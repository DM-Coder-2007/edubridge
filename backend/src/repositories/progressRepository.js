/**
 * EduBridge Adaptive - Progress & Mastery Repository (Snowflake)
 *
 * Mapped to EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS and EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class ProgressRepository {
  async upsertProgress({
    userId,
    lessonId,
    status = 'IN_PROGRESS',
    completionPercentage = 0.0,
    lastAudioPositionSeconds = 0.0,
    notes = null
  }) {
    const existing = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS WHERE USER_ID = ? AND LESSON_ID = ? ORDER BY UPDATED_AT DESC LIMIT 1',
      [userId, lessonId]
    );

    if (existing) {
      const updates = {
        STATUS: status,
        COMPLETION_PERCENTAGE: parseFloat(completionPercentage || 0),
        LAST_AUDIO_POSITION_SECONDS: parseFloat(lastAudioPositionSeconds || 0),
        UPDATED_AT: new Date().toISOString()
      };
      if (notes) updates.NOTES = notes;

      const recordId = existing.ID || existing.SESSION_ID;
      await db.update('EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS', updates, 'ID = ? OR SESSION_ID = ?', [recordId, recordId]);
      return this._formatProgress({ ...existing, ...updates });
    } else {
      const id = `sess_${uuidv4()}`;
      const record = {
        ID: id,
        SESSION_ID: id,
        USER_ID: userId,
        LESSON_ID: lessonId,
        STATUS: status,
        COMPLETION_PERCENTAGE: parseFloat(completionPercentage || 0),
        LAST_AUDIO_POSITION_SECONDS: parseFloat(lastAudioPositionSeconds || 0),
        STARTED_AT: new Date().toISOString(),
        NOTES: notes,
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      };

      await db.insert('EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS', record);
      return this._formatProgress(record);
    }
  }

  async getProgress(userId, lessonId) {
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS WHERE USER_ID = ? AND LESSON_ID = ? ORDER BY UPDATED_AT DESC LIMIT 1',
      [userId, lessonId]
    );
    return this._formatProgress(row);
  }

  async getAllProgressForUser(userId) {
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS WHERE USER_ID = ? ORDER BY UPDATED_AT DESC',
      [userId]
    );
    return rows.map(r => this._formatProgress(r));
  }

  async updateMastery({ userId, conceptId, isCorrect }) {
    const existing = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ? LIMIT 1',
      [userId, conceptId]
    );

    if (existing) {
      const attemptsCount = parseInt(existing.ATTEMPTS_COUNT || existing.ATTEMPTS || 0, 10) + 1;
      const successfulAttempts = parseInt(existing.CORRECT_COUNT || existing.CORRECT_ATTEMPTS || existing.SUCCESSFUL_ATTEMPTS || 0, 10) + (isCorrect ? 1 : 0);
      const masteryScore = Math.round((successfulAttempts / attemptsCount) * 100);

      let status = 'LEARNING';
      if (masteryScore >= 85 && attemptsCount >= 3) {
        status = 'MASTERED';
      } else if (masteryScore >= 60) {
        status = 'PROFICIENT';
      }

      const updates = {
        MASTERY_SCORE: masteryScore,
        ATTEMPTS: attemptsCount,
        ATTEMPTS_COUNT: attemptsCount,
        CORRECT_ATTEMPTS: successfulAttempts,
        CORRECT_COUNT: successfulAttempts,
        MASTERY_LEVEL: status,
        LAST_PRACTICED_AT: new Date().toISOString(),
        LAST_UPDATED: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      };

      const recordId = existing.ID;
      await db.update('EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY', updates, 'ID = ?', [recordId]);
      return this._formatMastery({ ...existing, ...updates });
    } else {
      const id = `mst_${uuidv4()}`;
      const attemptsCount = 1;
      const successfulAttempts = isCorrect ? 1 : 0;
      const masteryScore = isCorrect ? 100 : 0;

      const record = {
        ID: id,
        USER_ID: userId,
        CONCEPT_ID: conceptId,
        MASTERY_SCORE: masteryScore,
        ATTEMPTS: attemptsCount,
        ATTEMPTS_COUNT: attemptsCount,
        CORRECT_ATTEMPTS: successfulAttempts,
        CORRECT_COUNT: successfulAttempts,
        CONSECUTIVE_CORRECT: isCorrect ? 1 : 0,
        MASTERY_LEVEL: 'LEARNING',
        LAST_PRACTICED_AT: new Date().toISOString(),
        LAST_UPDATED: new Date().toISOString(),
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      };

      await db.insert('EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY', record);
      return this._formatMastery(record);
    }
  }

  async getMasteryForUser(userId) {
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? ORDER BY LAST_PRACTICED_AT DESC',
      [userId]
    );
    return rows.map(r => this._formatMastery(r));
  }

  _formatProgress(row) {
    if (!row) return null;
    return {
      id: row.ID || row.SESSION_ID,
      sessionId: row.SESSION_ID || row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID,
      status: row.STATUS,
      completionPercentage: parseFloat(row.COMPLETION_PERCENTAGE || 0),
      lastAudioPositionSeconds: parseFloat(row.LAST_AUDIO_POSITION_SECONDS || 0),
      lastAccessedAt: row.UPDATED_AT || row.STARTED_AT,
      notes: row.NOTES,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }

  _formatMastery(row) {
    if (!row) return null;
    return {
      id: row.ID || row.MASTERY_ID,
      masteryId: row.MASTERY_ID || row.ID,
      userId: row.USER_ID,
      conceptId: row.CONCEPT_ID,
      masteryScore: parseFloat(row.MASTERY_SCORE || 0),
      attemptsCount: parseInt(row.ATTEMPTS_COUNT || row.ATTEMPTS || 0, 10),
      successfulAttempts: parseInt(row.CORRECT_COUNT || row.CORRECT_ATTEMPTS || 0, 10),
      lastPracticedAt: row.LAST_PRACTICED_AT,
      status: row.MASTERY_LEVEL || 'LEARNING',
      masteryLevel: row.MASTERY_LEVEL || 'LEARNING',
      updatedAt: row.UPDATED_AT
    };
  }
}

module.exports = new ProgressRepository();
