/**
 * EduBridge Adaptive - Lesson Controller
 */

const lessonRepository = require('../repositories/lessonRepository');
const conceptRepository = require('../repositories/conceptRepository');
const quizRepository = require('../repositories/quizRepository');
const progressRepository = require('../repositories/progressRepository');
const ttsService = require('../services/ttsService');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class LessonController {
  async listUserLessons(req, res, next) {
    try {
      const lessons = await lessonRepository.findByUserId(req.user.id);
      return ApiResponse.success(res, 200, 'Lessons retrieved', { lessons });
    } catch (error) {
      next(error);
    }
  }

  async getLessonById(req, res, next) {
    try {
      const lesson = await lessonRepository.findById(req.params.id);
      if (!lesson) {
        return ApiResponse.error(res, 404, 'Lesson not found', 'LESSON_NOT_FOUND');
      }

      const concepts = await conceptRepository.findByLessonId(lesson.id);
      const questions = await quizRepository.findQuestionsByLessonId(lesson.id);
      const progress = await progressRepository.getProgress(req.user.id, lesson.id);

      return ApiResponse.success(res, 200, 'Lesson retrieved', {
        lesson,
        concepts,
        questions,
        progress
      });
    } catch (error) {
      next(error);
    }
  }

  async regenerateAudio(req, res, next) {
    try {
      const lesson = await lessonRepository.findById(req.params.id);
      if (!lesson) {
        return ApiResponse.error(res, 404, 'Lesson not found', 'LESSON_NOT_FOUND');
      }

      const { speakingRate, pitch, voice } = req.body;

      const narration = await ttsService.generateLessonNarration({
        lessonId: lesson.id,
        text: lesson.simplifiedText,
        options: {
          speakingRate: speakingRate !== undefined ? parseFloat(speakingRate) : 1.0,
          pitch: pitch !== undefined ? parseFloat(pitch) : 0.0,
          voice
        }
      });

      const updated = await lessonRepository.updateAudio(lesson.id, {
        audioUrl: narration.audioUrl,
        audioPublicId: narration.audioPublicId,
        audioDurationSeconds: narration.durationSeconds,
        waveformUrl: narration.waveformUrl
      });

      logger.info(`[LessonController] Regenerated Piper audio for lesson ${lesson.id}`);

      return ApiResponse.success(res, 200, 'Audio narration regenerated successfully via Piper TTS', {
        lesson: updated
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LessonController();
