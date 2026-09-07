/**
 * EduBridge Adaptive - Canonical Media Service
 *
 * Primary business layer for all media ingestion, transformation, and delivery.
 *
 * CRITICAL ARCHITECTURE RULE:
 * Cloudinary is the MANDATORY media storage and delivery platform.
 * Image/audio binary data is NEVER stored inside Snowflake.
 * Snowflake holds Cloudinary public IDs, URLs, and metadata.
 *
 * Architecture:
 * Controller -> MediaService -> Cloudinary Integration -> Cloudinary
 * And:
 * MediaService -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const cloudinaryUpload = require('../../integrations/cloudinary/upload.service');
const cloudinaryTransform = require('../../integrations/cloudinary/transformation.service');
const cloudinaryAsset = require('../../integrations/cloudinary/asset.service');
const cloudinaryDelete = require('../../integrations/cloudinary/delete.service');
const cloudinaryHealth = require('../../integrations/cloudinary/healthCheck');
const mediaRepository = require('../../repositories/media.repository');
const audioRepository = require('../../repositories/audio.repository');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../utils/errors');
const logger = require('../../utils/logger');

class MediaService {
  /**
   * Upload an original textbook image to Cloudinary and persist metadata in Snowflake
   *
   * Accepts either:
   * - uploadTextbookImage({ file, buffer, userId, title, subject, gradeLevel, chapterTitle, metadata, tags })
   * - uploadTextbookImage(buffer, options)
   *
   * @param {object|Buffer} arg1
   * @param {object} [arg2={}]
   * @returns {Promise<object>} Created textbook media asset
   */
  async uploadTextbookImage(arg1, arg2 = {}) {
    let buffer, options;
    if (Buffer.isBuffer(arg1)) {
      buffer = arg1;
      options = arg2;
    } else {
      buffer = arg1.buffer || (arg1.file && arg1.file.buffer);
      options = arg1;
    }

    const mimeType = options.mimeType || (options.file && options.file.mimetype) || 'image/jpeg';
    const userId = options.userId || 'system';
    const title = options.title || (options.file ? options.file.originalname : 'Textbook Scan');
    const subject = options.subject || 'General Education';
    const gradeLevel = options.gradeLevel || null;
    const chapterTitle = options.chapterTitle || null;
    const metadata = options.metadata || {};
    const tags = options.tags || [];

    logger.info(`[MediaService] Processing textbook image upload for user ${userId}`);

    // 1. Upload original image to Cloudinary (validates buffer, size, magic bytes, dimensions)
    const uploadResult = await cloudinaryUpload.uploadTextbookImage(buffer, {
      ...options,
      userId,
      mimeType,
      tags
    });

    // 2. Generate OCR-ready URL via non-destructive transformation
    const ocrUrl = cloudinaryTransform.getOcrImageUrl(uploadResult.publicId);

    // 3. Persist media metadata to Snowflake TEXTBOOK_ASSETS table
    let assetRecord = null;
    try {
      assetRecord = await mediaRepository.create({
        userId,
        title,
        subject,
        gradeLevel,
        chapterTitle,
        rawImageUrl: uploadResult.secureUrl,
        rawImagePublicId: uploadResult.publicId,
        processedImageUrl: ocrUrl,
        processedImagePublicId: uploadResult.publicId,
        processingStatus: 'UPLOADED',
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          version: uploadResult.version,
          folder: uploadResult.folder,
          ...metadata
        }
      });
      logger.info(`[MediaService] Textbook image asset saved in Snowflake (${assetRecord.id})`);
    } catch (err) {
      logger.warn('[MediaService] Could not persist to Snowflake repository, continuing with upload result:', err.message);
    }

    const assetId = assetRecord ? assetRecord.id : uploadResult.publicId;

    return {
      assetId,
      id: assetId,
      userId: assetRecord ? assetRecord.userId : userId,
      title: assetRecord ? assetRecord.title : title,
      publicId: uploadResult.publicId,
      public_id: uploadResult.publicId,
      rawImageUrl: uploadResult.secureUrl,
      secureUrl: uploadResult.secureUrl,
      url: uploadResult.secureUrl,
      ocrUrl,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      version: uploadResult.version,
      resourceType: 'image',
      processingStatus: assetRecord ? assetRecord.processingStatus : 'UPLOADED',
      createdAt: assetRecord ? assetRecord.createdAt : new Date().toISOString()
    };
  }

  /**
   * Upload lesson narration or spoken audio to Cloudinary and persist metadata in Snowflake
   *
   * Accepts either:
   * - uploadAudio({ file, buffer, userId, lessonId, format, duration, voice, tags, metadata })
   * - uploadAudio(buffer, options)
   *
   * @param {object|Buffer} arg1
   * @param {object} [arg2={}]
   * @returns {Promise<object>} Created audio asset record
   */
  async uploadAudio(arg1, arg2 = {}) {
    let buffer, options;
    if (Buffer.isBuffer(arg1)) {
      buffer = arg1;
      options = arg2;
    } else {
      buffer = arg1.buffer || (arg1.file && arg1.file.buffer);
      options = arg1;
    }

    const mimeType = options.mimeType || (options.file && options.file.mimetype) || 'audio/mpeg';
    const userId = options.userId || 'system';
    const lessonId = options.lessonId || null;
    const duration = options.duration ? parseFloat(options.duration) : 0.0;
    const voice = options.voice || options.voiceId || 'en_US-lessac-medium';
    const metadata = options.metadata || {};
    const tags = options.tags || [];

    logger.info(`[MediaService] Processing audio upload for user ${userId}, lesson ${lessonId}`);

    // 1. Upload audio to Cloudinary (validates buffer, size, magic bytes)
    const uploadResult = await cloudinaryUpload.uploadAudio(buffer, {
      ...options,
      userId,
      lessonId,
      mimeType,
      duration,
      voiceId: voice,
      tags
    });

    // 2. Generate waveform visualizer URL and streaming audio URL
    const waveformUrl = cloudinaryTransform.getWaveformUrl(uploadResult.publicId);
    const streamingUrl = cloudinaryTransform.getAudioUrl(uploadResult.publicId);

    // 3. Persist audio metadata in Snowflake AUDIO_ASSETS table
    let audioRecord = null;
    try {
      audioRecord = await audioRepository.create({
        userId,
        lessonId,
        entityType: 'LESSON',
        entityId: lessonId || `lesson_${uuidv4().substring(0, 8)}`,
        audioUrl: uploadResult.secureUrl,
        audioPublicId: uploadResult.publicId,
        audioFormat: uploadResult.format || 'mp3',
        durationSeconds: uploadResult.duration || duration || 0.0,
        fileSizeBytes: uploadResult.bytes,
        waveformUrl,
        voiceId: voice,
        ttsEngine: options.ttsEngine || 'PIPER_TTS',
        status: 'COMPLETED',
        metadata: {
          version: uploadResult.version,
          folder: uploadResult.folder,
          streamingUrl,
          ...metadata
        }
      });
      logger.info(`[MediaService] Audio asset metadata saved in Snowflake (${audioRecord.id})`);
    } catch (err) {
      logger.warn('[MediaService] Could not persist audio to Snowflake repository, continuing with upload result:', err.message);
    }

    const audioId = audioRecord ? audioRecord.id : uploadResult.publicId;

    return {
      audioId,
      id: audioId,
      userId: audioRecord ? audioRecord.userId : userId,
      lessonId: audioRecord ? audioRecord.lessonId : lessonId,
      publicId: uploadResult.publicId,
      public_id: uploadResult.publicId,
      audioUrl: uploadResult.secureUrl,
      secureUrl: uploadResult.secureUrl,
      url: uploadResult.secureUrl,
      streamingUrl,
      waveformUrl,
      resourceType: 'video',
      duration: uploadResult.duration || duration,
      format: uploadResult.format || 'mp3',
      bytes: uploadResult.bytes,
      context: uploadResult.context || {},
      tags: uploadResult.tags || [],
      status: audioRecord ? audioRecord.status : 'COMPLETED',
      createdAt: audioRecord ? audioRecord.createdAt : new Date().toISOString()
    };
  }

  /**
   * Retrieve a textbook media asset by ID with user ownership check
   *
   * @param {string} assetId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getTextbookAsset(assetId, userId) {
    if (!assetId) {
      throw new ValidationError('assetId is required.');
    }

    const asset = await mediaRepository.findById(assetId);
    if (!asset) {
      throw new NotFoundError(`Textbook media asset with ID "${assetId}" not found.`);
    }

    if (userId && asset.userId && asset.userId !== userId) {
      throw new ForbiddenError('Access denied: You cannot access another student\'s private media asset.');
    }

    const publicId = asset.rawImagePublicId || asset.cloudinaryPublicId;
    return {
      ...asset,
      ocrUrl: cloudinaryTransform.getOcrImageUrl(publicId),
      thumbnailUrl: cloudinaryTransform.getThumbnailUrl(publicId),
      optimizedUrl: cloudinaryTransform.getOptimizedImageUrl(publicId)
    };
  }

  /**
   * Delete a textbook media asset from Cloudinary and Snowflake with ownership check
   *
   * @param {string} assetId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async deleteTextbookAsset(assetId, userId) {
    if (!assetId) {
      throw new ValidationError('assetId is required.');
    }

    const asset = await mediaRepository.findById(assetId);
    if (!asset) {
      throw new NotFoundError(`Textbook media asset with ID "${assetId}" not found.`);
    }

    if (userId && asset.userId && asset.userId !== userId) {
      throw new ForbiddenError('Access denied: You cannot delete another student\'s private media asset.');
    }

    const publicId = asset.rawImagePublicId || asset.cloudinaryPublicId;

    // 1. Delete from Cloudinary
    try {
      if (publicId) {
        await cloudinaryDelete.deleteAsset(publicId, { resourceType: 'image', invalidate: true });
      }
    } catch (err) {
      logger.warn(`[MediaService] Cloudinary deletion error for ${publicId}:`, err.message);
    }

    // 2. Delete from Snowflake
    await mediaRepository.deleteById(assetId);
    logger.info(`[MediaService] Successfully deleted textbook asset ${assetId}`);

    return {
      success: true,
      message: 'Textbook asset deleted successfully from Cloudinary and Snowflake.',
      assetId
    };
  }

  /**
   * Get OCR-ready URL for an existing textbook asset
   *
   * @param {string} assetId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getOcrImageUrl(assetId, userId) {
    const asset = await this.getTextbookAsset(assetId, userId);
    const publicId = asset.rawImagePublicId || asset.cloudinaryPublicId;
    const ocrUrl = cloudinaryTransform.getOcrImageUrl(publicId);

    return {
      assetId: asset.id,
      publicId,
      ocrUrl
    };
  }

  /**
   * Retrieve audio asset metadata by ID with ownership check
   *
   * @param {string} audioId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getAudio(audioId, userId) {
    if (!audioId) {
      throw new ValidationError('audioId is required.');
    }

    const audio = await audioRepository.findById(audioId);
    if (!audio) {
      throw new NotFoundError(`Audio asset with ID "${audioId}" not found.`);
    }

    if (userId && audio.userId && audio.userId !== userId) {
      throw new ForbiddenError('Access denied: You cannot access another student\'s private audio asset.');
    }

    const publicId = audio.audioPublicId || audio.cloudinaryPublicId;
    return {
      ...audio,
      streamingUrl: cloudinaryTransform.getAudioUrl(publicId),
      waveformUrl: audio.waveformUrl || cloudinaryTransform.getWaveformUrl(publicId)
    };
  }

  /**
   * Get audio waveform visualization URL
   *
   * @param {string} audioId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getAudioWaveform(audioId, userId) {
    const audio = await this.getAudio(audioId, userId);
    const publicId = audio.audioPublicId || audio.cloudinaryPublicId;
    const waveformUrl = audio.waveformUrl || cloudinaryTransform.getWaveformUrl(publicId);

    return {
      audioId: audio.id,
      publicId,
      waveformUrl
    };
  }

  /**
   * Perform comprehensive Cloudinary health check
   *
   * @returns {Promise<object>} Diagnostics report
   */
  async checkCloudinaryHealth() {
    return cloudinaryHealth.checkHealth();
  }

  // --- Convenience delegates for backward compatibility ---
  async uploadImage(fileBuffer, options = {}) {
    return cloudinaryUpload.uploadImage(fileBuffer, options);
  }

  async uploadWaveform(fileBuffer, options = {}) {
    return cloudinaryUpload.uploadWaveform(fileBuffer, options);
  }

  generateImageTransformation(publicId, options = {}) {
    return cloudinaryTransform.generateImageTransformation(publicId, options);
  }

  generateAccessibleImageUrl(publicId, options = {}) {
    return cloudinaryTransform.generateAccessibleImageUrl(publicId, options);
  }

  generateWaveformUrl(publicId, options = {}) {
    return cloudinaryTransform.generateWaveformUrl(publicId, options);
  }

  generateStreamingAudioUrl(publicId, options = {}) {
    return cloudinaryTransform.generateStreamingAudioUrl(publicId, options);
  }

  async getAssetMetadata(publicId, options = {}) {
    return cloudinaryAsset.getAssetMetadata(publicId, options);
  }

  async deleteAsset(publicId, options = {}) {
    return cloudinaryDelete.deleteAsset(publicId, options);
  }
}

const mediaService = new MediaService();
module.exports = mediaService;
