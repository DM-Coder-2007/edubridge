/**
 * EduBridge Adaptive - Difficulty Progression Service
 *
 * Implements an adaptive difficulty engine combining:
 * 1. Recent accuracy vs historical accuracy (recent performance takes precedence)
 * 2. Time taken (fluency vs hesitation)
 * 3. Consecutive correct streaks and consecutive incorrect struggles
 * 4. Overall concept mastery state
 * 5. Audio-friendly transition cues designed for screen readers and speech synthesis
 */

const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

const NUMERIC_DIFFICULTY_MAP = {
  [DIFFICULTY_LEVELS.EASY]: 1,
  [DIFFICULTY_LEVELS.MEDIUM]: 2,
  [DIFFICULTY_LEVELS.HARD]: 3
};

const INVERSE_NUMERIC_MAP = {
  1: DIFFICULTY_LEVELS.EASY,
  2: DIFFICULTY_LEVELS.MEDIUM,
  3: DIFFICULTY_LEVELS.HARD
};

class DifficultyService {
  /**
   * Normalize arbitrary difficulty input to canonical 'easy', 'medium', or 'hard'
   */
  normalizeDifficulty(input) {
    if (!input) return DIFFICULTY_LEVELS.MEDIUM;

    if (typeof input === 'number') {
      const clamped = Math.max(1, Math.min(3, Math.round(input)));
      return INVERSE_NUMERIC_MAP[clamped];
    }

    const str = String(input).toLowerCase().trim();
    if (str.includes('hard') || str.includes('adv')) return DIFFICULTY_LEVELS.HARD;
    if (str.includes('easy') || str.includes('beg')) return DIFFICULTY_LEVELS.EASY;
    return DIFFICULTY_LEVELS.MEDIUM;
  }

  difficultyToNumeric(difficulty) {
    const normalized = this.normalizeDifficulty(difficulty);
    return NUMERIC_DIFFICULTY_MAP[normalized];
  }

  numericToDifficulty(numeric) {
    const clamped = Math.max(1, Math.min(3, Math.round(numeric || 2)));
    return INVERSE_NUMERIC_MAP[clamped];
  }

  /**
   * Determine the next difficulty level based on multi-factor heuristics
   *
   * @param {object} params
   * @param {string} [params.currentDifficulty='medium'] - Current difficulty
   * @param {boolean} params.isCorrect - Current answer correctness
   * @param {number} [params.score=100] - Current answer score (0-100)
   * @param {number} [params.timeTaken] - Time taken in seconds
   * @param {number} [params.consecutiveCorrect=0] - Current streak of correct answers
   * @param {number} [params.consecutiveIncorrect=0] - Current streak of incorrect answers
   * @param {number} [params.recentAccuracy=null] - Accuracy over recent window (0-1)
   * @param {number} [params.historicalAccuracy=null] - Accuracy over all attempts (0-1)
   * @param {number} [params.masteryScore=null] - Current concept mastery score (0-100)
   * @param {string} [params.aiRecommendation=null] - AI suggested difficulty
   * @returns {{ nextDifficulty: 'easy'|'medium'|'hard', previousDifficulty: string, changed: boolean, direction: 'UP'|'DOWN'|'STABLE', reason: string, voiceAnnouncement: string|null }}
   */
  determineNextDifficulty({
    currentDifficulty = DIFFICULTY_LEVELS.MEDIUM,
    isCorrect,
    score = isCorrect ? 100 : 0,
    timeTaken = null,
    consecutiveCorrect = 0,
    consecutiveIncorrect = 0,
    recentAccuracy = null,
    historicalAccuracy = null,
    masteryScore = null,
    aiRecommendation = null
  }) {
    const current = this.normalizeDifficulty(currentDifficulty);
    const aiTarget = aiRecommendation ? this.normalizeDifficulty(aiRecommendation) : null;
    const isBoolCorrect = Boolean(isCorrect);

    let nextDifficulty = current;
    let reason = 'Maintaining current difficulty level to build familiarity.';

    // Rule: Recent failures after historical success MUST lower difficulty
    const hasRecentFailures = consecutiveIncorrect >= 2 || (recentAccuracy !== null && recentAccuracy < 0.50);
    const isFluencyHesitation = isBoolCorrect && typeof timeTaken === 'number' && timeTaken > 60;

    if (!isBoolCorrect || hasRecentFailures) {
      // ----------------------------------------------------------------------
      // Struggle / Demotion Branch
      // ----------------------------------------------------------------------
      if (current === DIFFICULTY_LEVELS.HARD) {
        // Drop hard -> medium on any struggle
        nextDifficulty = DIFFICULTY_LEVELS.MEDIUM;
        reason = 'Recent struggle detected; adjusting from advanced to medium difficulty to rebuild confidence.';
      } else if (current === DIFFICULTY_LEVELS.MEDIUM) {
        // Drop medium -> easy if student misses repeatedly or recent accuracy plunged
        if (consecutiveIncorrect >= 2 || (recentAccuracy !== null && recentAccuracy <= 0.40) || score < 45 || aiTarget === DIFFICULTY_LEVELS.EASY) {
          nextDifficulty = DIFFICULTY_LEVELS.EASY;
          reason = 'Recent performance indicates difficulty with core principles; stepping down to easy difficulty.';
        } else {
          reason = 'Missed question at medium difficulty; remaining here to reinforce concepts before moving.';
        }
      } else if (current === DIFFICULTY_LEVELS.EASY) {
        reason = 'Remaining at foundational difficulty to solidify understanding with sensory analogies.';
      }
    } else {
      // ----------------------------------------------------------------------
      // Success / Promotion Branch
      // ----------------------------------------------------------------------
      if (isFluencyHesitation) {
        // Correct, but took very long: do not advance difficulty yet
        reason = 'Answer was correct but required significant time; maintaining difficulty to build fluency.';
      } else if (current === DIFFICULTY_LEVELS.EASY) {
        // Promote easy -> medium after demonstrated accuracy
        const strongRecent = recentAccuracy === null || recentAccuracy >= 0.65;
        if ((consecutiveCorrect >= 2 || score >= 80 || aiTarget === DIFFICULTY_LEVELS.MEDIUM || (masteryScore !== null && masteryScore >= 60)) && strongRecent) {
          nextDifficulty = DIFFICULTY_LEVELS.MEDIUM;
          reason = 'Advancing to medium difficulty after demonstrating consistent accuracy.';
        }
      } else if (current === DIFFICULTY_LEVELS.MEDIUM) {
        // Promote medium -> hard after sustained high performance
        const strongMastery = masteryScore === null || masteryScore >= 75;
        const sustainedStreak = consecutiveCorrect >= 3 || (consecutiveCorrect >= 2 && score >= 90);
        const highRecent = recentAccuracy === null || recentAccuracy >= 0.75;

        if (sustainedStreak && strongMastery && highRecent) {
          nextDifficulty = DIFFICULTY_LEVELS.HARD;
          reason = 'Advancing to challenging questions following a strong streak of mastery.';
        } else if (aiTarget === DIFFICULTY_LEVELS.HARD && consecutiveCorrect >= 2) {
          nextDifficulty = DIFFICULTY_LEVELS.HARD;
          reason = 'Advancing to hard difficulty as recommended by assessment evaluation.';
        }
      } else if (current === DIFFICULTY_LEVELS.HARD) {
        reason = 'Excellent mastery! Continuing at advanced difficulty.';
      }
    }

    const prevNum = this.difficultyToNumeric(current);
    const nextNum = this.difficultyToNumeric(nextDifficulty);

    let direction = 'STABLE';
    if (nextNum > prevNum) direction = 'UP';
    else if (nextNum < prevNum) direction = 'DOWN';

    return {
      nextDifficulty,
      previousDifficulty: current,
      changed: nextDifficulty !== current,
      direction,
      reason,
      voiceAnnouncement: this.formatDifficultyChangeAnnouncement(current, nextDifficulty, reason)
    };
  }

  /**
   * Formulate voice-friendly audio cue for screen reader / speech narration
   */
  formatDifficultyChangeAnnouncement(previousDiff, nextDiff, reason) {
    if (previousDiff === nextDiff) {
      return null;
    }

    if (nextDiff === DIFFICULTY_LEVELS.HARD) {
      return `[Audio Cue: bright chime] Challenge unlocked! Advancing to advanced questions.`;
    }
    if (nextDiff === DIFFICULTY_LEVELS.MEDIUM && previousDiff === DIFFICULTY_LEVELS.EASY) {
      return `[Audio Cue: rising tone] Nice work! Stepping up to medium difficulty.`;
    }
    if (nextDiff === DIFFICULTY_LEVELS.EASY) {
      return `[Audio Cue: gentle chime] Let's slow down and practice the fundamentals.`;
    }

    return `[Audio Cue: soft chime] Difficulty adjusted to ${nextDiff}.`;
  }
}

const difficultyService = new DifficultyService();
module.exports = difficultyService;
