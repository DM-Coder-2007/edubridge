/**
 * EduBridge Adaptive - Dashboard Controller
 *
 * Handles HTTP requests for:
 * - GET /api/dashboard (high-level student learning summary & activity)
 * - GET /api/dashboard/progress (detailed lesson completion & reading progress)
 * - GET /api/dashboard/mastery (comprehensive concept mastery analytics & weak areas)
 *
 * Architecture: Controller -> Service -> Repository -> Snowflake
 */

const mediaRepository = require('../repositories/media.repository');
const lessonRepository = require('../repositories/lesson.repository');
const attemptRepository = require('../repositories/attempt.repository');
const masteryRepository = require('../repositories/mastery.repository');
const progressRepository = require('../repositories/progressRepository');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class DashboardController {
  /**
   * GET /api/dashboard
   * High-level student summary overview
   */
  async getDashboardSummary(req, res, next) {
    try {
      const userId = req.user.id;
      logger.info(`[DashboardController] Getting dashboard summary for user ${userId}`);

      const [textbooks, lessons, attempts, conceptMasteries] = await Promise.all([
        mediaRepository.findByUserId(userId),
        lessonRepository.findByUserId(userId),
        attemptRepository.findByUserId(userId),
        masteryRepository.findAllByUserId(userId)
      ]);

      const masteredConcepts = conceptMasteries.filter(m => m.masteryScore >= 85);
      const weakConcepts = conceptMasteries.filter(m => m.masteryScore < 60);

      const totalScore = conceptMasteries.reduce((sum, m) => sum + (m.masteryScore || 0), 0);
      const overallMasteryScore = conceptMasteries.length > 0
        ? Math.round(totalScore / conceptMasteries.length)
        : 0;

      const recentAttempts = attempts.slice(0, 5);

      return ApiResponse.success(res, 200, 'Dashboard overview retrieved successfully', {
        student: {
          id: req.user.id,
          fullName: req.user.fullName,
          email: req.user.email,
          gradeLevel: req.user.gradeLevel,
          preferredLanguage: req.user.preferredLanguage,
          accessibilityPreferences: req.user.accessibilityPreferences || {}
        },
        overview: {
          totalTextbooks: textbooks.length,
          totalLessons: lessons.length,
          totalAttempts: attempts.length,
          totalConceptsTracked: conceptMasteries.length,
          masteredConceptsCount: masteredConcepts.length,
          weakConceptsCount: weakConcepts.length,
          overallMasteryScore
        },
        recentActivity: {
          recentAttempts,
          recentTextbooks: textbooks.slice(0, 3),
          recentLessons: lessons.slice(0, 3)
        }
      });
    } catch (error) {
      logger.error('[DashboardController] getDashboardSummary error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/dashboard/progress
   * Detailed student lesson completion and audio listening progress
   */
  async getDashboardProgress(req, res, next) {
    try {
      const userId = req.user.id;
      logger.info(`[DashboardController] Getting progress analytics for user ${userId}`);

      const [lessons, progressList] = await Promise.all([
        lessonRepository.findByUserId(userId),
        progressRepository.getAllProgressForUser(userId)
      ]);

      const progressMap = new Map();
      progressList.forEach(p => progressMap.set(p.lessonId, p));

      const lessonProgress = lessons.map(lesson => {
        const prog = progressMap.get(lesson.id);
        return {
          lessonId: lesson.id,
          title: lesson.title,
          status: prog?.status || 'NOT_STARTED',
          completionPercentage: prog?.completionPercentage || 0,
          lastAudioPositionSeconds: prog?.lastAudioPositionSeconds || 0,
          audioDurationSeconds: lesson.audioDurationSeconds || 0,
          hasAudio: Boolean(lesson.audioUrl),
          difficultyLevel: lesson.difficultyLevel,
          lastAccessedAt: prog?.lastAccessedAt || lesson.createdAt
        };
      });

      const completedCount = lessonProgress.filter(lp => lp.status === 'COMPLETED').length;
      const inProgressCount = lessonProgress.filter(lp => lp.status === 'IN_PROGRESS').length;
      const notStartedCount = lessonProgress.filter(lp => lp.status === 'NOT_STARTED').length;

      const totalCompletion = lessonProgress.reduce((sum, lp) => sum + lp.completionPercentage, 0);
      const avgCompletionPercentage = lessonProgress.length > 0
        ? Math.round(totalCompletion / lessonProgress.length)
        : 0;

      return ApiResponse.success(res, 200, 'Dashboard progress retrieved successfully', {
        summary: {
          totalLessons: lessons.length,
          completedLessons: completedCount,
          inProgressLessons: inProgressCount,
          notStartedLessons: notStartedCount,
          averageCompletionPercentage: avgCompletionPercentage
        },
        lessons: lessonProgress
      });
    } catch (error) {
      logger.error('[DashboardController] getDashboardProgress error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/dashboard/mastery
   * Comprehensive concept mastery analytics, retention decay, and weak areas
   */
  async getDashboardMastery(req, res, next) {
    try {
      const userId = req.user.id;
      logger.info(`[DashboardController] Getting mastery analytics for user ${userId}`);

      const conceptMasteries = await masteryRepository.findAllByUserId(userId);

      const mastered = conceptMasteries.filter(m => m.masteryScore >= 85);
      const proficient = conceptMasteries.filter(m => m.masteryScore >= 60 && m.masteryScore < 85);
      const weak = conceptMasteries.filter(m => m.masteryScore < 60);

      const totalScore = conceptMasteries.reduce((sum, m) => sum + (m.masteryScore || 0), 0);
      const overallMasteryScore = conceptMasteries.length > 0
        ? Math.round(totalScore / conceptMasteries.length)
        : 0;

      const recommendedReinforcement = weak.map(w => ({
        conceptId: w.conceptId,
        currentMasteryScore: w.masteryScore,
        attemptsCount: w.attemptsCount,
        recommendation: 'Needs simpler analogies and reinforced practice'
      }));

      return ApiResponse.success(res, 200, 'Dashboard mastery analytics retrieved successfully', {
        analytics: {
          totalConcepts: conceptMasteries.length,
          masteredCount: mastered.length,
          proficientCount: proficient.length,
          weakCount: weak.length,
          overallMasteryScore
        },
        breakdown: {
          mastered,
          proficient,
          weak
        },
        recommendedReinforcement
      });
    } catch (error) {
      logger.error('[DashboardController] getDashboardMastery error:', error.message);
      next(error);
    }
  }
}

const dashboardController = new DashboardController();
module.exports = dashboardController;
