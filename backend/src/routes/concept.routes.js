/**
 * EduBridge Adaptive - Concept & Adaptive Mastery Routes
 *
 * Mandated Endpoints:
 * - GET /api/concepts/:id/mastery
 * - GET /api/concepts/:id
 */

const express = require('express');
const router = express.Router();
const adaptiveController = require('../controllers/adaptive.controller');
const conceptRepository = require('../repositories/conceptRepository');
const { authenticate } = require('../middleware/auth.middleware');
const ApiResponse = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');

// All concept endpoints require authentication
router.use(authenticate);

// Concepts by Lesson
router.get('/lesson/:lessonId', async (req, res, next) => {
  try {
    const concepts = await conceptRepository.findByLessonId(req.params.lessonId);
    return ApiResponse.success(res, 200, 'Lesson concepts retrieved', {
      lessonId: req.params.lessonId,
      concepts,
      count: concepts.length
    });
  } catch (error) {
    next(error);
  }
});

// Concept Mastery
router.get('/:id/mastery', (req, res, next) => adaptiveController.getConceptMastery(req, res, next));

// Concept Details
router.get('/:id', async (req, res, next) => {
  try {
    const concept = await conceptRepository.findById(req.params.id);
    if (!concept) {
      throw new NotFoundError(`Concept with ID "${req.params.id}" not found.`);
    }
    return ApiResponse.success(res, 200, 'Concept details retrieved', { concept });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
