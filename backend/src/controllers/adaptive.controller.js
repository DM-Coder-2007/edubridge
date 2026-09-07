/**
 * EduBridge Adaptive - Adaptive Controller
 *
 * Handles HTTP requests for:
 * - GET /api/concepts/:id/mastery (retrieve user's mastery on a specific concept)
 * - GET /api/lessons/:id/mastery (retrieve user's overall mastery across a lesson)
 *
 * Architecture: Controller -> Service -> Repository -> Snowflake
 */

const masteryRepository = require('../repositories/mastery.repository');
const lessonRepository = require('../repositories/lesson.repository');
const questionRepository = require('../repositories/question.repository');
const ApiResponse = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class AdaptiveController {
  /**
   * GET /api/concepts/:id/mastery
   * Retrieve student mastery score and progression history for a specific concept
   */
  async getConceptMastery(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Concept ID parameter is required.', { field: 'id' });
      }

      logger.info(`[AdaptiveController] Fetching concept mastery for user ${req.user.id}, concept ${id}`);
      const mastery = await masteryRepository.findByUserAndConcept(req.user.id, id);

      if (!mastery) {
        return ApiResponse.success(res, 200, 'Concept mastery initialized for student', {
          mastery: {
            conceptId: id,
            userId: req.user.id,
            masteryScore: 0,
            attemptsCount: 0,
            correctCount: 0,
            consecutiveCorrect: 0,
            masteryLevel: 'NOVICE',
            decayRate: 0.05,
            lastPracticedAt: null,
            masteryHistory: []
          }
        });
      }

      return ApiResponse.success(res, 200, 'Concept mastery retrieved successfully', {
        mastery
      });
    } catch (error) {
      logger.error('[AdaptiveController] getConceptMastery error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/lessons/:id/mastery
   * Retrieve aggregate concept mastery breakdown for a lesson
   */
  async getLessonMastery(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Lesson ID parameter is required.', { field: 'id' });
      }

      const lesson = await lessonRepository.findById(id);
      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const userMasteryList = await masteryRepository.findAllByUserId(req.user.id);
      const questions = await questionRepository.findByLessonId(id);
      const lessonConceptIds = [...new Set(questions.map(q => q.conceptId).filter(Boolean))];

      const conceptMastery = userMasteryList.filter(m => lessonConceptIds.includes(m.conceptId));
      const avgScore = conceptMastery.length > 0
        ? Math.round(conceptMastery.reduce((acc, m) => acc + m.masteryScore, 0) / conceptMastery.length)
        : 0;

      return ApiResponse.success(res, 200, 'Lesson mastery retrieved successfully', {
        lessonId: id,
        overallMasteryScore: avgScore,
        conceptsTracked: conceptMastery.length,
        conceptMastery
      });
    } catch (error) {
      logger.error('[AdaptiveController] getLessonMastery error:', error.message);
      next(error);
    }
  }
}

const adaptiveController = new AdaptiveController();
module.exports = adaptiveController;
