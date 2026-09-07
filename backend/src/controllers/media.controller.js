/**
 * EduBridge Adaptive - Media Controller
 *
 * Implements REST endpoints for Cloudinary Media Infrastructure:
 * - POST   /api/media/textbook
 * - GET    /api/media/textbook/:assetId
 * - DELETE /api/media/textbook/:assetId
 * - GET    /api/media/textbook/:assetId/ocr-url
 * - GET    /api/media/health
 * - POST   /api/media/audio
 * - GET    /api/media/audio/:audioId
 * - GET    /api/media/audio/:audioId/waveform
 *
 * ARCHITECTURE RULE:
 * Controllers never execute Cloudinary SDK or Snowflake queries directly.
 * Controller -> MediaService -> Integration / Repository.
 */

const mediaService = require('../services/media/media.service');
const ApiResponse = require('../utils/apiResponse');
const { ValidationError, UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

class MediaController {
  /**
   * POST /api/media/textbook
   * Upload an original textbook image to Cloudinary and store metadata in Snowflake
   */
  async uploadTextbook(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 400, 'Image file is required (multipart field "image").', 'MISSING_FILE');
      }

      const userId = req.user ? req.user.id : req.userId;
      if (!userId) {
        return ApiResponse.error(res, 401, 'Authentication required to upload textbook images.', 'UNAUTHORIZED');
      }

      const { title, subject, gradeLevel, chapterTitle } = req.body || {};

      const result = await mediaService.uploadTextbookImage({
        file: req.file,
        userId,
        title,
        subject,
        gradeLevel,
        chapterTitle
      });

      return ApiResponse.success(res, 201, 'Textbook image uploaded and stored in Cloudinary', result);
    } catch (error) {
      logger.error('[MediaController] uploadTextbook error:', error);
      next(error);
    }
  }

  /**
   * GET /api/media/textbook/:assetId
   * Retrieve a textbook media asset and its transformation URLs
   */
  async getTextbook(req, res, next) {
    try {
      const { assetId } = req.params;
      const userId = req.user ? req.user.id : req.userId;

      const asset = await mediaService.getTextbookAsset(assetId, userId);
      return ApiResponse.success(res, 200, 'Textbook asset retrieved successfully', asset);
    } catch (error) {
      logger.error('[MediaController] getTextbook error:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/media/textbook/:assetId
   * Delete a textbook asset from Cloudinary and Snowflake
   */
  async deleteTextbook(req, res, next) {
    try {
      const { assetId } = req.params;
      const userId = req.user ? req.user.id : req.userId;

      const result = await mediaService.deleteTextbookAsset(assetId, userId);
      return ApiResponse.success(res, 200, result.message, result);
    } catch (error) {
      logger.error('[MediaController] deleteTextbook error:', error);
      next(error);
    }
  }

  /**
   * GET /api/media/textbook/:assetId/ocr-url
   * Generate or retrieve OCR-ready delivery URL for a textbook asset
   */
  async getOcrUrl(req, res, next) {
    try {
      const { assetId } = req.params;
      const userId = req.user ? req.user.id : req.userId;

      const result = await mediaService.getOcrImageUrl(assetId, userId);
      return ApiResponse.success(res, 200, 'OCR-ready delivery URL retrieved', result);
    } catch (error) {
      logger.error('[MediaController] getOcrUrl error:', error);
      next(error);
    }
  }

  /**
   * GET /api/media/health
   * Verify Cloudinary configuration and connectivity without leaking credentials
   */
  async getHealth(req, res, next) {
    try {
      const health = await mediaService.checkCloudinaryHealth();
      const isHealthy = health.status === 'healthy';

      return res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        service: 'cloudinary',
        status: health.status,
        cloudName: health.cloudName,
        mode: health.mode,
        latencyMs: health.latencyMs
      });
    } catch (error) {
      logger.error('[MediaController] getHealth error:', error);
      return ApiResponse.error(res, 503, `Cloudinary health check failed: ${error.message}`, 'CLOUDINARY_HEALTH_ERROR');
    }
  }

  /**
   * POST /api/media/audio
   * Upload an audio file to Cloudinary and store metadata in Snowflake
   */
  async uploadAudio(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 400, 'Audio file is required (multipart field "audio").', 'MISSING_FILE');
      }

      const userId = req.user ? req.user.id : req.userId;
      if (!userId) {
        return ApiResponse.error(res, 401, 'Authentication required to upload audio.', 'UNAUTHORIZED');
      }

      const { lessonId, duration, voice } = req.body || {};

      const result = await mediaService.uploadAudio({
        file: req.file,
        userId,
        lessonId,
        duration: duration ? parseFloat(duration) : 0.0,
        voice
      });

      return ApiResponse.success(res, 201, 'Audio file uploaded to Cloudinary', result);
    } catch (error) {
      logger.error('[MediaController] uploadAudio error:', error);
      next(error);
    }
  }

  /**
   * GET /api/media/audio/:audioId
   * Retrieve audio asset metadata and streaming URL
   */
  async getAudio(req, res, next) {
    try {
      const { audioId } = req.params;
      const userId = req.user ? req.user.id : req.userId;

      const audio = await mediaService.getAudio(audioId, userId);
      return ApiResponse.success(res, 200, 'Audio asset retrieved successfully', audio);
    } catch (error) {
      logger.error('[MediaController] getAudio error:', error);
      next(error);
    }
  }

  /**
   * GET /api/media/audio/:audioId/waveform
   * Retrieve audio waveform visualizer URL
   */
  async getWaveform(req, res, next) {
    try {
      const { audioId } = req.params;
      const userId = req.user ? req.user.id : req.userId;

      const result = await mediaService.getAudioWaveform(audioId, userId);
      return ApiResponse.success(res, 200, 'Audio waveform URL retrieved', result);
    } catch (error) {
      logger.error('[MediaController] getWaveform error:', error);
      next(error);
    }
  }
}

const mediaController = new MediaController();
// Convenience method aliases
mediaController.uploadTextbookImage = (req, res, next) => mediaController.uploadTextbook(req, res, next);
mediaController.getTextbookAsset = (req, res, next) => mediaController.getTextbook(req, res, next);
mediaController.deleteTextbookAsset = (req, res, next) => mediaController.deleteTextbook(req, res, next);

module.exports = mediaController;
