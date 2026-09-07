/**
 * EduBridge Adaptive - Textbook Controller
 */

const pipelineService = require('../services/pipelineService');
const ocrService = require('../services/ocr/ocr.service');
const textbookRepository = require('../repositories/textbookRepository');
const processingStatusRepository = require('../repositories/processingStatusRepository');
const lessonRepository = require('../repositories/lessonRepository');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class TextbookController {
  async processScan(req, res, next) {
    try {
      const { title, subject, gradeLevel, chapterTitle, speakingRate, pitch, voice } = req.body;

      const voicePreferences = {
        speakingRate: speakingRate ? parseFloat(speakingRate) : (req.user.accessibilityPreferences?.voiceSpeed || 1.0),
        pitch: pitch ? parseFloat(pitch) : (req.user.accessibilityPreferences?.pitch || 0.0),
        voice
      };

      const result = await pipelineService.processTextbookScan({
        imageBuffer: req.file.buffer,
        userId: req.user.id,
        title,
        subject,
        gradeLevel: gradeLevel || req.user.gradeLevel || 'Middle School',
        chapterTitle,
        voicePreferences
      });

      return ApiResponse.success(res, 201, 'Textbook processed into accessible lesson and narration via Piper TTS', result);
    } catch (error) {
      logger.error('[TextbookController] Error processing scan:', error);
      next(error);
    }
  }

  async listUserTextbooks(req, res, next) {
    try {
      const textbooks = await textbookRepository.findByUserId(req.user.id);
      return ApiResponse.success(res, 200, 'Textbooks retrieved successfully', { textbooks });
    } catch (error) {
      next(error);
    }
  }

  async getTextbookById(req, res, next) {
    try {
      const textbook = await textbookRepository.findById(req.params.id);
      if (!textbook) {
        return ApiResponse.error(res, 404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
      }

      const lessons = await lessonRepository.findByTextbookId(textbook.id);

      return ApiResponse.success(res, 200, 'Textbook retrieved', {
        textbook,
        lessons
      });
    } catch (error) {
      next(error);
    }
  }

  async getProcessingStatus(req, res, next) {
    try {
      const textbook = await textbookRepository.findById(req.params.id);
      if (!textbook) {
        return ApiResponse.error(res, 404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
      }

      const history = await processingStatusRepository.getAllForEntity(textbook.id);
      return ApiResponse.success(res, 200, 'Processing history retrieved', {
        currentStatus: textbook.processingStatus,
        history
      });
    } catch (error) {
      next(error);
    }
  }

  async processOcr(req, res, next) {
    try {
      const { title, subject, gradeLevel, chapterTitle } = req.body || {};
      const result = await ocrService.processTextbookImage({
        buffer: req.file ? req.file.buffer : null,
        userId: req.user ? req.user.id : req.body.userId,
        title,
        subject,
        gradeLevel,
        chapterTitle,
        mimeType: req.file ? req.file.mimetype : 'image/jpeg'
      });

      return ApiResponse.success(res, 201, 'Textbook OCR processed successfully', result);
    } catch (error) {
      logger.error('[TextbookController] OCR processing failed:', error.message);
      next(error);
    }
  }

  async getOcrResult(req, res, next) {
    try {
      const result = await ocrService.getOcrResult(req.params.id);
      if (!result) {
        return ApiResponse.error(res, 404, 'OCR result not found', 'OCR_NOT_FOUND');
      }
      return ApiResponse.success(res, 200, 'OCR result retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async retryOcr(req, res, next) {
    try {
      const result = await ocrService.retryProcessing(
        req.params.id,
        req.file ? req.file.buffer : undefined
      );
      return ApiResponse.success(res, 200, 'OCR processing retried successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TextbookController();
