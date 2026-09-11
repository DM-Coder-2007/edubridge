/**
 * EduBridge Adaptive - Textbook Controller
 *
 * Handles HTTP requests for:
 * - POST   /api/textbooks (upload and process textbook scan)
 * - GET    /api/textbooks (list user's textbooks)
 * - GET    /api/textbooks/:id (get single textbook scan details & OCR status)
 * - DELETE /api/textbooks/:id (delete textbook scan and Cloudinary assets)
 *
 * Architecture: Controller -> Service -> Repository -> Snowflake
 */

const mediaRepository = require('../repositories/media.repository');
const lessonRepository = require('../repositories/lesson.repository');
const ocrService = require('../services/ocr/ocr.service');
const mediaService = require('../services/media/media.service');
const ApiResponse = require('../utils/apiResponse');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

class TextbookController {
  /**
   * POST /api/textbooks
   * Upload and process a new textbook page/chapter scan
   */
  async uploadTextbook(req, res, next) {
    try {
      const { title, subject = 'General Science', gradeLevel, chapterTitle } = req.body || {};

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new ValidationError('Textbook title is required.', { field: 'title' });
      }

      // Check if image buffer is uploaded via multer or base64
      let imageBuffer = req.file ? req.file.buffer : null;
      let mimeType = req.file ? req.file.mimetype : 'image/jpeg';

      if (!imageBuffer && req.body.imageBase64) {
        imageBuffer = Buffer.from(req.body.imageBase64, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
      }

      const targetUrl = req.body.imageUrl || req.body.rawImageUrl || req.body.url || req.body.secure_url;
      const targetPublicId = req.body.rawImagePublicId || req.body.publicId;

      // If buffer or URL provided, run through OCR pipeline service
      if (imageBuffer || targetUrl) {
        logger.info(`[TextbookController] Processing textbook image for user ${req.user.id}: "${title}"`);
        const result = await ocrService.processTextbookImage({
          buffer: imageBuffer,
          imageUrl: targetUrl,
          rawImageUrl: targetUrl,
          userId: req.user.id,
          title: title.trim(),
          subject: subject.trim(),
          gradeLevel: gradeLevel || req.user.gradeLevel,
          chapterTitle: chapterTitle ? chapterTitle.trim() : null,
          mimeType
        });

        const created = await mediaRepository.create({
          userId: req.user.id,
          title: title.trim(),
          subject: subject.trim(),
          gradeLevel: gradeLevel || req.user.gradeLevel,
          chapterTitle: chapterTitle ? chapterTitle.trim() : null,
          rawImageUrl: result.media?.rawImageUrl || targetUrl || 'https://res.cloudinary.com/edubridge/image/upload/sample.jpg',
          rawImagePublicId: targetPublicId || (result.media?.publicId) || `edubridge/textbooks/raw/raw_${result.assetId || Date.now()}`,
          processedImageUrl: result.media?.processedImageUrl,
          accessibleImageUrl: result.media?.accessibleImageUrl,
          processingStatus: result.status || 'COMPLETED',
          metadata: {
            ...(result.structuredOcr || {}),
            rawText: result.structuredOcr?.rawText
          }
        });

        // Structured Debugging Log (UPLOAD requirement - Section 11)
        logger.info('[OCR_DEBUG][UPLOAD]', {
          lessonId: req.body.lessonId || null,
          assetId: created.id || result.assetId,
          rawImagePublicId: created.rawImagePublicId,
          rawImageUrl: created.rawImageUrl
        });

        return ApiResponse.success(res, 201, 'Textbook uploaded and OCR pipeline completed', {
          textbook: created,
          structuredOcr: result.structuredOcr
        });
      }

      throw new ValidationError('An image file or Cloudinary image URL is required to process textbook.');
    } catch (error) {
      logger.error('[TextbookController] uploadTextbook failed:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/textbooks
   * List all textbooks for the current authenticated user
   */
  async listTextbooks(req, res, next) {
    try {
      const textbooks = await mediaRepository.findByUserId(req.user.id);
      return ApiResponse.success(res, 200, 'Textbooks retrieved successfully', {
        textbooks,
        count: textbooks.length
      });
    } catch (error) {
      logger.error('[TextbookController] listTextbooks error:', error);
      next(error);
    }
  }

  /**
   * GET /api/textbooks/:id
   * Get single textbook details, processing state, and OCR results
   */
  async getTextbookById(req, res, next) {
    try {
      const { id } = req.params;
      const textbook = await mediaRepository.findById(id);

      if (!textbook) {
        throw new NotFoundError(`Textbook with ID "${id}" not found.`, { id });
      }

      // User isolation: Ensure student cannot view other students' textbooks
      if (textbook.userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'teacher') {
        throw new ForbiddenError('Access denied: You do not have permission to view this textbook.', 'FORBIDDEN');
      }

      // Fetch associated lessons
      const lessons = await lessonRepository.findByTextbookAssetId(textbook.id);

      return ApiResponse.success(res, 200, 'Textbook details retrieved', {
        textbook,
        lessons
      });
    } catch (error) {
      logger.error('[TextbookController] getTextbookById error:', error.message);
      next(error);
    }
  }

  /**
   * DELETE /api/textbooks/:id
   * Delete textbook record and associated Cloudinary media
   */
  async deleteTextbook(req, res, next) {
    try {
      const { id } = req.params;
      const textbook = await mediaRepository.findById(id);

      if (!textbook) {
        throw new NotFoundError(`Textbook with ID "${id}" not found.`, { id });
      }

      // User isolation
      if (textbook.userId !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Access denied: You cannot delete another user\'s textbook.', 'USER_ISOLATION_VIOLATION');
      }

      // Clean up Cloudinary asset if public ID is known
      if (textbook.rawImagePublicId) {
        try {
          await mediaService.deleteAsset(textbook.rawImagePublicId, 'image');
        } catch (e) {
          logger.warn(`[TextbookController] Cloudinary asset deletion skipped: ${e.message}`);
        }
      }

      // Delete from Snowflake
      await mediaRepository.deleteById(id);

      logger.info(`[TextbookController] Deleted textbook ${id} for user ${req.user.id}`);
      return ApiResponse.success(res, 200, 'Textbook deleted successfully', { id });
    } catch (error) {
      logger.error('[TextbookController] deleteTextbook error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/textbooks/jobs/:jobId
   * Get real-time status of background textbook/lesson creation job
   */
  async getJobStatus(req, res, next) {
    try {
      const { jobId } = req.params;
      const processingQueue = require('../jobs/processingQueue');
      const job = processingQueue.getJob(jobId);

      if (!job) {
        // Fallback check if jobId corresponds to a direct assetId
        const textbook = await mediaRepository.findById(jobId);
        if (textbook) {
          return ApiResponse.success(res, 200, 'Processing status retrieved', {
            jobId,
            assetId: textbook.id,
            status: textbook.processingStatus || 'COMPLETED',
            step: textbook.processingStatus === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
            progressPercent: textbook.processingStatus === 'COMPLETED' ? 100 : 50,
            textbook
          });
        }
        throw new NotFoundError(`Background job with ID "${jobId}" not found.`);
      }

      return ApiResponse.success(res, 200, 'Job status retrieved', {
        jobId: job.id,
        status: job.status,
        step: job.step || job.status,
        progressPercent: job.progressPercent || (job.status === 'COMPLETED' ? 100 : 50),
        assetId: job.assetId || null,
        lessonId: job.lessonId || null,
        result: job.result || null,
        error: job.error || null,
        createdAt: job.createdAt,
        completedAt: job.completedAt || null
      });
    } catch (error) {
      logger.error('[TextbookController] getJobStatus error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/textbooks/:id/status
   * Get processing status for a given textbook asset ID
   */
  async getProcessingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const textbook = await mediaRepository.findById(id);

      if (!textbook) {
        throw new NotFoundError(`Textbook with ID "${id}" not found.`);
      }

      return ApiResponse.success(res, 200, 'Textbook status retrieved', {
        assetId: textbook.id,
        status: textbook.processingStatus || 'COMPLETED',
        step: textbook.processingStatus || 'COMPLETED',
        progressPercent: textbook.processingStatus === 'COMPLETED' ? 100 : 50,
        textbook
      });
    } catch (error) {
      logger.error('[TextbookController] getProcessingStatus error:', error.message);
      next(error);
    }
  }
}

const textbookController = new TextbookController();
module.exports = textbookController;
