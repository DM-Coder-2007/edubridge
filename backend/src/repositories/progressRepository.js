/**
 * EduBridge Adaptive - Progress & Mastery Repository (Snowflake)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

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
      'SELECT * FROM PROGRESS WHERE USER_ID = ? AND LESSON_ID = ? LIMIT 1',
      [userId, lessonId]
    );

    if (existing) {
      const updates = {
        STATUS: status,
        COMPLETION_PERCENTAGE: completionPercentage,
        LAST_AUDIO_POSITION_SECONDS: lastAudioPositionSeconds,
        LAST_ACCESSED_AT: new Date().toISOString()
      };
      if (notes) updates.NOTES = notes;

      await db.update('PROGRESS', updates, 'ID = ?', [existing.ID]);
      return this._formatProgress({ ...existing, ...updates });
    } else {
      const id = uuidv4();
      const record = {
        ID: id,
        USER_ID: userId,
        LESSON_ID: lessonId,
        STATUS: status,
        COMPLETION_PERCENTAGE: completionPercentage,
        LAST_AUDIO_POSITION_SECONDS: lastAudioPositionSeconds,
        LAST_ACCESSED_AT: new Date().toISOString(),
        NOTES: notes,
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      };

      await db.insert('PROGRESS', record);
      return this._formatProgress(record);
    }
  }

  async getProgress(userId, lessonId) {
    const row = await db.queryOne(
      'SELECT * FROM PROGRESS WHERE USER_ID = ? AND LESSON_ID = ? LIMIT 1',
      [userId, lessonId]
    );
    return this._formatProgress(row);
  }

  async getAllProgressForUser(userId) {
    const rows = await db.query(
      'SELECT * FROM PROGRESS WHERE USER_ID = ? ORDER BY LAST_ACCESSED_AT DESC',
      [userId]
    );
    return rows.map(r => this._formatProgress(r));
  }

  async updateMastery({ userId, conceptId, isCorrect }) {
    const existing = await db.queryOne(
      'SELECT * FROM MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ? LIMIT 1',
      [userId, conceptId]
    );

    if (existing) {
      const attemptsCount = parseInt(existing.ATTEMPTS_COUNT || 0, 10) + 1;
      const successfulAttempts = parseInt(existing.SUCCESSFUL_ATTEMPTS || 0, 10) + (isCorrect ? 1 : 0);
      const masteryScore = Math.round((successfulAttempts / attemptsCount) * 100);

      let status = 'LEARNING';
      if (masteryScore >= 85 && attemptsCount >= 3) {
        status = 'MASTERED';
      } else if (masteryScore >= 60) {
        status = 'PROFICIENT';
      }

      const updates = {
        MASTERY_SCORE: masteryScore,
        ATTEMPTS_COUNT: attemptsCount,
        SUCCESSFUL_ATTEMPTS: successfulAttempts,
        LAST_PRACTICED_AT: new Date().toISOString(),
        STATUS: status
      };

      await db.update('MASTERY', updates, 'ID = ?', [existing.ID]);
      return this._formatMastery({ ...existing, ...updates });
    } else {
      const id = uuidv4();
      const attemptsCount = 1;
      const successfulAttempts = isCorrect ? 1 : 0;
      const masteryScore = isCorrect ? 100 : 0;

      const record = {
        ID: id,
        USER_ID: userId,
        CONCEPT_ID: conceptId,
        MASTERY_SCORE: masteryScore,
        ATTEMPTS_COUNT: attemptsCount,
        SUCCESSFUL_ATTEMPTS: successfulAttempts,
        LAST_PRACTICED_AT: new Date().toISOString(),
        STATUS: 'LEARNING',
        UPDATED_AT: new Date().toISOString()
      };

      await db.insert('MASTERY', record);
      return this._formatMastery(record);
    }
  }

  async getMasteryForUser(userId) {
    const rows = await db.query(
      'SELECT * FROM MASTERY WHERE USER_ID = ? ORDER BY LAST_PRACTICED_AT DESC',
      [userId]
    );
    return rows.map(r => this._formatMastery(r));
  }

  _formatProgress(row) {
    if (!row) return null;
    return {
      id: row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID,
      status: row.STATUS,
      completionPercentage: parseFloat(row.COMPLETION_PERCENTAGE || 0),
      lastAudioPositionSeconds: parseFloat(row.LAST_AUDIO_POSITION_SECONDS || 0),
      lastAccessedAt: row.LAST_ACCESSED_AT,
      notes: row.NOTES,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }

  _formatMastery(row) {
    if (!row) return null;
    return {
      id: row.ID,
      userId: row.USER_ID,
      conceptId: row.CONCEPT_ID,
      masteryScore: parseFloat(row.MASTERY_SCORE || 0),
      attemptsCount: parseInt(row.ATTEMPTS_COUNT || 0, 10),
      successfulAttempts: parseInt(row.SUCCESSFUL_ATTEMPTS || 0, 10),
      lastPracticedAt: row.LAST_PRACTICED_AT,
      status: row.STATUS,
      updatedAt: row.UPDATED_AT
    };
  }
}

module.exports = new ProgressRepository();
