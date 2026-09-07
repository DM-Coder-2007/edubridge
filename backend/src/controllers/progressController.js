/**
 * EduBridge Adaptive - Progress Controller
 */

const progressRepository = require('../repositories/progressRepository');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class ProgressController {
  async getOverview(req, res, next) {
    try {
      const progressList = await progressRepository.getAllProgressForUser(req.user.id);
      const masteryList = await progressRepository.getMasteryForUser(req.user.id);

      const totalLessons = progressList.length;
      const completedLessons = progressList.filter(p => p.status === 'COMPLETED').length;
      const overallPercentage = totalLessons > 0
        ? Math.round(progressList.reduce((acc, curr) => acc + curr.completionPercentage, 0) / totalLessons)
        : 0;

      return ApiResponse.success(res, 200, 'Student progress overview retrieved', {
        stats: {
          totalLessonsTracked: totalLessons,
          completedLessons,
          overallAveragePercentage: overallPercentage,
          conceptsPracticed: masteryList.length
        },
        progress: progressList,
        mastery: masteryList
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLessonProgress(req, res, next) {
    try {
      const { lessonId } = req.params;
      const { completionPercentage, lastAudioPositionSeconds, status, notes } = req.body;

      const progress = await progressRepository.upsertProgress({
        userId: req.user.id,
        lessonId,
        completionPercentage: completionPercentage !== undefined ? parseFloat(completionPercentage) : 0,
        lastAudioPositionSeconds: lastAudioPositionSeconds !== undefined ? parseFloat(lastAudioPositionSeconds) : 0,
        status: status || (completionPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS'),
        notes
      });

      logger.info(`[ProgressController] Updated progress for user ${req.user.id} on lesson ${lessonId}: ${progress.completionPercentage}%`);

      return ApiResponse.success(res, 200, 'Lesson progress updated', { progress });
    } catch (error) {
      next(error);
    }
  }

  async getMastery(req, res, next) {
    try {
      const mastery = await progressRepository.getMasteryForUser(req.user.id);
      return ApiResponse.success(res, 200, 'Concept mastery data retrieved', { mastery });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProgressController();
