/**
 * EduBridge Adaptive - Concept Controller
 */

const conceptRepository = require('../repositories/conceptRepository');
const ApiResponse = require('../utils/apiResponse');

class ConceptController {
  async getConceptById(req, res, next) {
    try {
      const concept = await conceptRepository.findById(req.params.id);
      if (!concept) {
        return ApiResponse.error(res, 404, 'Concept not found', 'CONCEPT_NOT_FOUND');
      }
      return ApiResponse.success(res, 200, 'Concept retrieved', { concept });
    } catch (error) {
      next(error);
    }
  }

  async getConceptsByLesson(req, res, next) {
    try {
      const concepts = await conceptRepository.findByLessonId(req.params.lessonId);
      return ApiResponse.success(res, 200, 'Concepts retrieved', { concepts });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConceptController();
