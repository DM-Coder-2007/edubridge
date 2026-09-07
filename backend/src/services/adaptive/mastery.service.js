/**
 * EduBridge Adaptive - Concept Mastery Service
 *
 * Implements an evidence-based cognitive mastery engine:
 * 1. Spaced repetition forgetting curve (Ebbinghaus exponential decay)
 * 2. Multi-factor mastery weighting:
 *    - Recent accuracy (sliding window of last 5 attempts)
 *    - Historical accuracy across all attempts
 *    - Time taken vs expected time (fluency vs hesitation/rushing)
 *    - Question difficulty weighting (easy, medium, hard)
 *    - Consecutive correct streaks & consecutive incorrect struggle
 * 3. Mastery levels: NOVICE (0-39), DEVELOPING (40-64), PROFICIENT (65-84), MASTERED (85-100)
 * 4. Snowflake persistence in EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY
 * 5. Security: Frontend is NEVER permitted to directly mutate mastery scores
 */

const { v4: uuidv4 } = require('uuid');
const databaseManager = require('../../database/snowflake/databaseManager');
const logger = require('../../utils/logger');

const DEFAULT_DECAY_RATE = 0.05; // ~5% decay per day without practice
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const MASTERY_LEVELS = {
  NOVICE: 'NOVICE',
  DEVELOPING: 'DEVELOPING',
  PROFICIENT: 'PROFICIENT',
  MASTERED: 'MASTERED'
};

const DIFFICULTY_WEIGHTS = {
  easy: { gainMultiplier: 0.80, lossMultiplier: 1.30, expectedTime: 20 },
  medium: { gainMultiplier: 1.00, lossMultiplier: 1.00, expectedTime: 35 },
  hard: { gainMultiplier: 1.30, lossMultiplier: 0.70, expectedTime: 50 }
};

class MasteryService {
  /**
   * Determine categorical mastery level based on score, streak, and attempts
   *
   * @param {number} score - Mastery score (0-100)
   * @param {number} consecutiveCorrect - Current correct streak
   * @param {number} attemptsCount - Total attempts
   * @returns {'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED'}
   */
  computeMasteryLevel(score, consecutiveCorrect = 0, attemptsCount = 1) {
    if (score >= 85 && (consecutiveCorrect >= 2 || attemptsCount >= 3)) {
      return MASTERY_LEVELS.MASTERED;
    }
    if (score >= 65) {
      return MASTERY_LEVELS.PROFICIENT;
    }
    if (score > 40) {
      return MASTERY_LEVELS.DEVELOPING;
    }
    return MASTERY_LEVELS.NOVICE;
  }

  /**
   * Calculate decayed score based on spaced repetition forgetting curve
   * S(t) = S0 * e^(-decayRate * deltaDays)
   */
  calculateDecayedScore(currentScore, lastPracticedAt, decayRate = DEFAULT_DECAY_RATE) {
    if (!lastPracticedAt || currentScore <= 0) {
      return { decayedScore: Math.max(0, currentScore || 0), daysElapsed: 0 };
    }

    const lastDate = new Date(lastPracticedAt).getTime();
    const now = Date.now();
    const elapsedDays = Math.max(0, (now - lastDate) / MILLIS_PER_DAY);

    const decayFactor = Math.exp(-decayRate * elapsedDays);
    const decayed = Math.round(currentScore * decayFactor * 100) / 100;

    return {
      decayedScore: Math.max(0, Math.min(100, decayed)),
      daysElapsed: Math.round(elapsedDays * 10) / 10
    };
  }

  /**
   * Compute multi-factor mastery update considering:
   * 1. Recent accuracy (last 5 attempts)
   * 2. Historical accuracy (all attempts)
   * 3. Time taken (fluency vs hesitation)
   * 4. Question difficulty (easy, medium, hard)
   * 5. Number of attempts
   * 6. Consecutive correct
   * 7. Consecutive incorrect
   *
   * @param {object} params
   * @param {number} [params.currentScore=0] - Previous mastery score (0-100)
   * @param {Array<object>} [params.previousAttempts=[]] - History of attempts [{ isCorrect, timeTaken, difficulty }]
   * @param {number} [params.consecutiveCorrect=0] - Previous correct streak
   * @param {number} [params.consecutiveIncorrect=0] - Previous incorrect streak
   * @param {number} [params.attemptsCount=0] - Total previous attempts
   * @param {number} [params.correctCount=0] - Total previous correct attempts
   * @param {boolean} params.isCorrect - Current answer correctness
   * @param {number} [params.timeTaken=30] - Time taken in seconds
   * @param {string} [params.difficulty='medium'] - Question difficulty ('easy', 'medium', 'hard')
   * @param {string|Date} [params.lastPracticedAt] - Timestamp of prior attempt
   * @param {number} [params.decayRate=DEFAULT_DECAY_RATE] - Forgetting curve rate
   * @returns {object} Full mastery calculation output
   */
  calculateMasteryUpdate({
    currentScore = 0,
    previousAttempts = [],
    consecutiveCorrect = 0,
    consecutiveIncorrect = 0,
    attemptsCount = 0,
    correctCount = 0,
    isCorrect,
    timeTaken = null,
    difficulty = 'medium',
    lastPracticedAt = null,
    decayRate = DEFAULT_DECAY_RATE
  }) {
    const isBoolCorrect = Boolean(isCorrect);
    const diffNorm = String(difficulty || 'medium').toLowerCase();
    const diffConfig = DIFFICULTY_WEIGHTS[diffNorm] || DIFFICULTY_WEIGHTS.medium;

    // 1. Spaced Repetition Decay
    const { decayedScore, daysElapsed } = this.calculateDecayedScore(currentScore, lastPracticedAt, decayRate);

    // 2. Counters & Streaks
    let prevConsecutiveCorrect = consecutiveCorrect;
    let prevConsecutiveIncorrect = consecutiveIncorrect;

    if (previousAttempts.length > 0 && consecutiveCorrect === 0 && consecutiveIncorrect === 0) {
      let trailingCorrect = 0;
      let trailingIncorrect = 0;
      for (let i = previousAttempts.length - 1; i >= 0; i--) {
        if (previousAttempts[i].isCorrect) {
          if (trailingIncorrect === 0) trailingCorrect++;
          else break;
        } else {
          if (trailingCorrect === 0) trailingIncorrect++;
          else break;
        }
      }
      prevConsecutiveCorrect = trailingCorrect;
      prevConsecutiveIncorrect = trailingIncorrect;
    }

    const newAttemptsCount = (attemptsCount > 0 ? attemptsCount : previousAttempts.length) + 1;
    const newCorrectCount = (correctCount > 0 ? correctCount : previousAttempts.filter(a => a.isCorrect).length) + (isBoolCorrect ? 1 : 0);
    const newConsecutiveCorrect = isBoolCorrect ? prevConsecutiveCorrect + 1 : 0;
    const newConsecutiveIncorrect = !isBoolCorrect ? prevConsecutiveIncorrect + 1 : 0;

    // 3. Historical Accuracy (all attempts)
    const historicalAccuracy = Math.round((newCorrectCount / newAttemptsCount) * 100) / 100;

    // 4. Recent Accuracy (sliding window of last 5 attempts)
    const recentWindow = [
      ...previousAttempts.slice(-4).map(a => Boolean(a.isCorrect)),
      isBoolCorrect
    ];
    const recentCorrectCount = recentWindow.filter(Boolean).length;
    const recentAccuracy = Math.round((recentCorrectCount / recentWindow.length) * 100) / 100;

    // 5. Time Taken / Fluency Factor
    let timeFactor = 1.0;
    let isFluencyStruggle = false;
    let isRushed = false;

    if (typeof timeTaken === 'number' && timeTaken > 0) {
      const expTime = diffConfig.expectedTime;
      if (isBoolCorrect) {
        if (timeTaken <= expTime) {
          // Fluent response within expected time: minor speed bonus
          const speedRatio = Math.max(0, (expTime - timeTaken) / expTime);
          timeFactor = 1.0 + Math.min(0.15, speedRatio * 0.15);
        } else if (timeTaken > expTime * 2.2) {
          // Labored response: took more than double expected time
          timeFactor = 0.85;
          isFluencyStruggle = true;
        }
      } else {
        if (timeTaken < expTime * 0.25) {
          // Rushed guess: answered excessively fast (< 25% of expected time)
          timeFactor = 1.25; // amplified penalty
          isRushed = true;
        } else if (timeTaken > expTime * 2.5) {
          // Sustained struggle: spent very long time and still failed
          isFluencyStruggle = true;
        }
      }
    }

    // 6. Score Update Logic
    let newScore;
    const isFirstAttempt = (newAttemptsCount === 1 && currentScore === 0 && previousAttempts.length === 0);

    if (isFirstAttempt) {
      // First attempt: initialize score
      if (isBoolCorrect) {
        newScore = Math.round(75 * diffConfig.gainMultiplier * timeFactor);
      } else {
        newScore = Math.max(10, Math.round(25 / (diffConfig.lossMultiplier * timeFactor)));
      }
    } else if (isBoolCorrect) {
      // Correct Answer:
      // Weight recent accuracy (65%) and historical accuracy (35%)
      const blendedAccuracy = (recentAccuracy * 0.65) + (historicalAccuracy * 0.35);

      // Mastery gain increases with remaining headroom (100 - decayedScore)
      const headroom = 100 - decayedScore;
      const baseGain = Math.max(8, headroom * 0.32);
      const streakBonus = Math.min(12, Math.floor(newConsecutiveCorrect / 2) * 4);

      const computedGain = (baseGain * diffConfig.gainMultiplier * timeFactor) + streakBonus;
      let calculated = decayedScore + computedGain;

      // Bound calculated score with respect to blended accuracy
      const accuracyCap = Math.round(blendedAccuracy * 100) + 10;
      newScore = Math.min(100, Math.min(accuracyCap, Math.round(calculated)));
    } else {
      // Incorrect Answer:
      // Drop is proportional to current score and difficulty
      const dropBase = Math.max(12, decayedScore * 0.28);
      const strugglePenalty = newConsecutiveIncorrect >= 2 ? (newConsecutiveIncorrect * 5) : 0;

      const computedDrop = (dropBase * diffConfig.lossMultiplier * timeFactor) + strugglePenalty;
      let calculated = decayedScore - computedDrop;

      // Even with strong history, consecutive failures pull mastery down
      if (newConsecutiveIncorrect >= 2) {
        const dropCap = Math.max(30, 85 - (newConsecutiveIncorrect * 15));
        calculated = Math.min(calculated, dropCap);
      }

      newScore = Math.max(0, Math.round(calculated));
    }

    // 7. Ensure consistency with requirements:
    // 5 attempts, 2 correct -> mastery remains low (<= 40)
    if (newAttemptsCount >= 5 && newCorrectCount <= 2) {
      newScore = Math.min(40, newScore);
    }
    // 5 attempts, 5 correct -> mastery high (>= 85)
    if (newAttemptsCount >= 5 && newCorrectCount === newAttemptsCount && newConsecutiveCorrect >= 5) {
      newScore = Math.max(85, newScore);
    }

    const delta = newScore - currentScore;
    const masteryLevel = this.computeMasteryLevel(newScore, newConsecutiveCorrect, newAttemptsCount);

    return {
      masteryScore: newScore,
      previousScore: currentScore,
      decayedScoreBeforeAttempt: decayedScore,
      daysSinceLastPractice: daysElapsed,
      delta,
      masteryLevel,
      attemptsCount: newAttemptsCount,
      correctCount: newCorrectCount,
      consecutiveCorrect: newConsecutiveCorrect,
      consecutiveIncorrect: newConsecutiveIncorrect,
      recentAccuracy,
      historicalAccuracy,
      timeTakenSeconds: timeTaken,
      isFluencyStruggle,
      isRushed,
      difficulty: diffNorm,
      isCorrect: isBoolCorrect
    };
  }

  /**
   * Record a concept attempt and persist updated mastery to Snowflake
   *
   * @param {object} params
   * @param {string} params.userId - Student user ID
   * @param {string} params.conceptId - Concept identifier
   * @param {boolean} params.isCorrect - Answer correctness
   * @param {number} [params.timeTaken] - Time taken in seconds
   * @param {string} [params.difficulty='medium'] - Question difficulty ('easy', 'medium', 'hard')
   * @param {string} [params.conceptName] - Concept title/name
   * @returns {Promise<object>} Persisted concept mastery record
   */
  async recordConceptAttempt({
    userId,
    conceptId,
    isCorrect,
    timeTaken = null,
    difficulty = 'medium',
    conceptName = null
  }) {
    if (!userId || !conceptId) {
      throw new Error('userId and conceptId are required to record concept mastery.');
    }

    logger.info(
      `[MasteryService] Recording attempt: user=${userId}, concept=${conceptId}, isCorrect=${isCorrect}, time=${timeTaken}s, diff=${difficulty}`
    );

    // 1. Fetch existing record from Snowflake
    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ? LIMIT 1',
      [userId, conceptId]
    );

    const existing = rows.length > 0 ? rows[0] : null;

    let currentScore = 0;
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;
    let attemptsCount = 0;
    let correctCount = 0;
    let lastPracticedAt = null;
    let decayRate = DEFAULT_DECAY_RATE;
    let history = [];

    if (existing) {
      currentScore = parseFloat(existing.MASTERY_SCORE || 0);
      consecutiveCorrect = parseInt(existing.CONSECUTIVE_CORRECT || 0, 10);
      attemptsCount = parseInt(existing.ATTEMPTS_COUNT || 0, 10);
      correctCount = parseInt(existing.CORRECT_COUNT || 0, 10);
      lastPracticedAt = existing.LAST_PRACTICED_AT;
      decayRate = parseFloat(existing.DECAY_RATE || DEFAULT_DECAY_RATE);

      if (existing.MASTERY_HISTORY) {
        try {
          history = typeof existing.MASTERY_HISTORY === 'string'
            ? JSON.parse(existing.MASTERY_HISTORY)
            : existing.MASTERY_HISTORY;
        } catch {
          history = [];
        }
      }

      // Reconstruct consecutiveIncorrect from history
      let trailingFails = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].isCorrect) trailingFails++;
        else break;
      }
      consecutiveIncorrect = trailingFails;
    }

    // 2. Compute updated mastery metrics
    const updateResult = this.calculateMasteryUpdate({
      currentScore,
      previousAttempts: history,
      consecutiveCorrect,
      consecutiveIncorrect,
      attemptsCount,
      correctCount,
      isCorrect,
      timeTaken,
      difficulty,
      lastPracticedAt,
      decayRate
    });

    const nowIso = new Date().toISOString();

    // 3. Append to historical progress timeline
    history.push({
      timestamp: nowIso,
      score: updateResult.masteryScore,
      delta: updateResult.delta,
      isCorrect: Boolean(isCorrect),
      level: updateResult.masteryLevel,
      timeTaken,
      difficulty,
      recentAccuracy: updateResult.recentAccuracy,
      historicalAccuracy: updateResult.historicalAccuracy,
      conceptName
    });

    if (history.length > 50) {
      history = history.slice(-50);
    }

    // 4. Persist to Snowflake
    if (existing) {
      await databaseManager.update(
        'CONCEPT_MASTERY',
        {
          MASTERY_SCORE: updateResult.masteryScore,
          ATTEMPTS_COUNT: updateResult.attemptsCount,
          CORRECT_COUNT: updateResult.correctCount,
          CONSECUTIVE_CORRECT: updateResult.consecutiveCorrect,
          MASTERY_LEVEL: updateResult.masteryLevel,
          LAST_PRACTICED_AT: nowIso,
          MASTERY_HISTORY: history,
          UPDATED_AT: nowIso
        },
        'ID = ?',
        [existing.ID]
      );

      try {
        const masteryRepo = require('../../repositories/mastery.repository');
        await masteryRepo.upsertMastery({
          userId,
          conceptId,
          masteryScore: updateResult.masteryScore,
          attemptsCount: updateResult.attemptsCount,
          correctCount: updateResult.correctCount,
          consecutiveCorrect: updateResult.consecutiveCorrect,
          masteryLevel: updateResult.masteryLevel,
          decayRate
        });
      } catch (repoErr) {
        logger.warn(`[MasteryService] Non-fatal masteryRepo sync warning: ${repoErr.message}`);
      }

      return {
        id: existing.ID,
        userId,
        conceptId,
        conceptName,
        ...updateResult,
        lastPracticedAt: nowIso,
        history
      };
    } else {
      const newId = `cpt_mst_${uuidv4()}`;
      const record = {
        ID: newId,
        USER_ID: userId,
        CONCEPT_ID: conceptId,
        MASTERY_SCORE: updateResult.masteryScore,
        ATTEMPTS_COUNT: updateResult.attemptsCount,
        CORRECT_COUNT: updateResult.correctCount,
        CONSECUTIVE_CORRECT: updateResult.consecutiveCorrect,
        MASTERY_LEVEL: updateResult.masteryLevel,
        DECAY_RATE: decayRate,
        LAST_PRACTICED_AT: nowIso,
        MASTERY_HISTORY: history,
        CREATED_AT: nowIso,
        UPDATED_AT: nowIso
      };

      await databaseManager.insert('CONCEPT_MASTERY', record);

      try {
        const masteryRepo = require('../../repositories/mastery.repository');
        await masteryRepo.upsertMastery({
          userId,
          conceptId,
          masteryScore: updateResult.masteryScore,
          attemptsCount: updateResult.attemptsCount,
          correctCount: updateResult.correctCount,
          consecutiveCorrect: updateResult.consecutiveCorrect,
          masteryLevel: updateResult.masteryLevel,
          decayRate
        });
      } catch (repoErr) {
        logger.warn(`[MasteryService] Non-fatal masteryRepo sync warning: ${repoErr.message}`);
      }

      return {
        id: newId,
        userId,
        conceptId,
        conceptName,
        ...updateResult,
        lastPracticedAt: nowIso,
        history
      };
    }
  }

  /**
   * Retrieve mastery for a single concept for a student
   */
  async getConceptMastery(userId, conceptId) {
    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? AND CONCEPT_ID = ? LIMIT 1',
      [userId, conceptId]
    );

    if (rows.length === 0) return null;
    return this._formatMasteryRow(rows[0]);
  }

  /**
   * Retrieve student's overall concept mastery summary
   */
  async getUserMasterySummary(userId) {
    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY WHERE USER_ID = ? ORDER BY LAST_PRACTICED_AT DESC',
      [userId]
    );

    const formatted = rows.map(r => this._formatMasteryRow(r));
    const totalConcepts = formatted.length;

    let totalScore = 0;
    let masteredCount = 0;
    let proficientCount = 0;
    let developingCount = 0;
    let noviceCount = 0;

    for (const item of formatted) {
      totalScore += item.masteryScore;
      if (item.masteryLevel === MASTERY_LEVELS.MASTERED) masteredCount++;
      else if (item.masteryLevel === MASTERY_LEVELS.PROFICIENT) proficientCount++;
      else if (item.masteryLevel === MASTERY_LEVELS.DEVELOPING) developingCount++;
      else noviceCount++;
    }

    const averageMastery = totalConcepts > 0 ? Math.round((totalScore / totalConcepts) * 10) / 10 : 0;

    return {
      userId,
      totalConceptsTracked: totalConcepts,
      averageMastery,
      masteredCount,
      proficientCount,
      developingCount,
      noviceCount,
      concepts: formatted
    };
  }

  /**
   * Identify struggling concepts for dynamic remediation
   */
  async getStrugglingConcepts(userId, threshold = 65) {
    const summary = await this.getUserMasterySummary(userId);
    return summary.concepts
      .filter(c => c.masteryScore < threshold || c.masteryLevel === MASTERY_LEVELS.NOVICE)
      .sort((a, b) => a.masteryScore - b.masteryScore);
  }

  /**
   * Security guard: Rejects attempts by client payloads to directly alter mastery scores
   */
  assertClientCannotMutateMastery(payload) {
    if (payload && (payload.masteryScore !== undefined || payload.mastery_score !== undefined || payload.masteryLevel !== undefined)) {
      throw new Error('Forbidden: Client is not authorized to directly modify mastery scores or levels.');
    }
  }

  _formatMasteryRow(row) {
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
      masteryScore: parseFloat(row.MASTERY_SCORE || 0),
      attemptsCount: parseInt(row.ATTEMPTS_COUNT || 0, 10),
      correctCount: parseInt(row.CORRECT_COUNT || 0, 10),
      consecutiveCorrect: parseInt(row.CONSECUTIVE_CORRECT || 0, 10),
      masteryLevel: row.MASTERY_LEVEL || MASTERY_LEVELS.NOVICE,
      decayRate: parseFloat(row.DECAY_RATE || DEFAULT_DECAY_RATE),
      lastPracticedAt: row.LAST_PRACTICED_AT,
      history,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const masteryService = new MasteryService();
module.exports = masteryService;
