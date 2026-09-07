/**
 * EduBridge Adaptive - Textbook Image OCR Processing Service
 *
 * PIPELINE FLOW:
 * Client -> Express Upload -> MIME/Size Validation -> Sharp Preprocessing
 * -> Cloudinary Original Upload -> Cloudinary OCR-ready Transformation
 * -> Gemini Multimodal Processing -> Structured OCR Result -> Snowflake
 *
 * STATUS LIFECYCLE:
 * UPLOADED -> PREPROCESSING -> OCR_PROCESSING -> COMPLETED (or FAILED)
 *
 * CRITICAL ARCHITECTURE RULES:
 * - Controller -> Service -> Integration architecture
 * - No direct Gemini calls in routes/controllers
 * - Full structured OCR schema output (title, rawText, sections, concepts, formulas, examples)
 * - Snowflake is the primary database (persists status, metadata, errors, retry count)
 * - Cloudinary holds all binary image assets
 * - Never silently lose failed jobs
 */

const { v4: uuidv4 } = require('uuid');
const imagePreprocessor = require('./imagePreprocessor');
const ocrValidator = require('./ocr.validator');
const { normalizeOcrResult } = require('./ocr.schema');
const mediaService = require('../media/media.service');
const gemini = require('../../integrations/gemini');
const databaseManager = require('../../database/snowflake/databaseManager');
const logger = require('../../utils/logger');

class OcrService {
  /**
   * Complete end-to-end OCR processing pipeline
   *
   * @param {object} params
   * @param {Buffer} params.buffer - Original uploaded image buffer
   * @param {string} params.userId - Authenticated user ID
   * @param {string} params.title - Textbook page title
   * @param {string} params.subject - Academic subject
   * @param {string} [params.chapterTitle] - Chapter title
   * @param {string} [params.gradeLevel] - Grade level
   * @param {string} [params.mimeType='image/jpeg'] - Image MIME type
   * @param {string} [params.textbookAssetId] - Optional existing asset ID (for retries)
   * @returns {Promise<object>} Result containing asset record and structured OCR output
   */
  async processTextbookImage(params) {
    const {
      buffer: initialBuffer,
      imageUrl,
      rawImageUrl,
      userId,
      title,
      subject,
      chapterTitle = null,
      gradeLevel = 'Middle School',
      mimeType = 'image/jpeg',
      textbookAssetId
    } = params;

    const assetId = textbookAssetId || `txt_${uuidv4()}`;

    // ------------------------------------------------------------------------
    // Step 0: Server-side Cloudinary Image Retrieval (if URL provided)
    // ------------------------------------------------------------------------
    let buffer = initialBuffer;
    let activeMime = mimeType;
    const targetUrl = imageUrl || rawImageUrl;

    if (!buffer && targetUrl) {
      logger.info(`[OcrService] Retrieving actual image bytes from Cloudinary URL: ${targetUrl}`);
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) {
          throw new ImageRetrievalError(`Cloudinary returned HTTP ${res.status}: ${res.statusText}`);
        }
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (contentType.includes('html') || contentType.includes('json') || !contentType.startsWith('image/')) {
          throw new ImageRetrievalError(`Cloudinary URL returned invalid non-image content-type "${contentType}"`);
        }
        activeMime = contentType;
        const arrayBuf = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } catch (fetchErr) {
        logger.error(`[OcrService] Image retrieval failed from Cloudinary: ${fetchErr.message}`);
        if (fetchErr instanceof ImageRetrievalError) throw fetchErr;
        throw new ImageRetrievalError(`Failed to download image from Cloudinary: ${fetchErr.message}`);
      }
    }

    logger.info(`[OcrService] Starting OCR processing pipeline for asset: ${assetId}`, {
      userId,
      title,
      subject,
      bytes: buffer ? buffer.length : 0,
      mimeType: activeMime
    });

    // ------------------------------------------------------------------------
    // Step 1: MIME & Size Validation
    // ------------------------------------------------------------------------
    try {
      ocrValidator.validateUpload(buffer, { mimeType: activeMime, userId, title, subject });
    } catch (validationErr) {
      logger.error('[OcrService] Validation failed before pipeline start:', validationErr.message);
      throw validationErr;
    }

    // ------------------------------------------------------------------------
    // Step 2: Initialize Record in Snowflake with status UPLOADED
    // ------------------------------------------------------------------------
    let assetRecord = {
      ID: assetId,
      USER_ID: userId,
      TITLE: title,
      SUBJECT: subject,
      CHAPTER_TITLE: chapterTitle,
      GRADE_LEVEL: gradeLevel,
      RAW_IMAGE_URL: targetUrl || '',
      RAW_IMAGE_PUBLIC_ID: '',
      PROCESSING_STATUS: 'UPLOADED',
      RETRY_COUNT: 0,
      ERROR_MESSAGE: null
    };

    try {
      if (!textbookAssetId) {
        await databaseManager.insert('TEXTBOOK_ASSETS', assetRecord);
      } else {
        await databaseManager.update(
          'TEXTBOOK_ASSETS',
          { PROCESSING_STATUS: 'UPLOADED', ERROR_MESSAGE: null },
          'ID = ?',
          [assetId]
        );
      }

      await this._logAudit(assetId, 'OCR_PIPELINE_INIT', 'STARTED', 10, null, userId);
    } catch (dbErr) {
      logger.error('[OcrService] Snowflake initialization failed:', { error: dbErr.message });
      throw new Error(`Snowflake error during job initialization: ${dbErr.message}`);
    }

    try {
      // ----------------------------------------------------------------------
      // Step 3: Sharp Preprocessing & Image Quality Check
      // ----------------------------------------------------------------------
      await this._updateStatus(assetId, 'PREPROCESSING', {
        PROCESSING_STARTED_AT: new Date().toISOString()
      });
      await this._logAudit(assetId, 'SHARP_PREPROCESSING', 'IN_PROGRESS', 25, null, userId);

      const preprocessed = await imagePreprocessor.preprocessForOcr(buffer);
      const isLowQuality = preprocessed.metadata.isLowQuality;

      // ----------------------------------------------------------------------
      // Step 4: Cloudinary Original Upload (Preserves Original Image Asset)
      // ----------------------------------------------------------------------
      const rawUpload = await mediaService.uploadImage(buffer, {
        folder: 'edubridge/textbooks/raw',
        publicId: `raw_${assetId}`,
        userId,
        textbookId: assetId,
        mimeType: activeMime
      });

      // ----------------------------------------------------------------------
      // Step 5: Cloudinary OCR-Ready Transformation & Preprocessed Upload
      // ----------------------------------------------------------------------
      const processedUpload = await mediaService.uploadImage(preprocessed.buffer, {
        folder: 'edubridge/textbooks/processed',
        publicId: `proc_${assetId}`,
        userId,
        textbookId: assetId,
        mimeType: 'image/jpeg'
      });

      // Generate non-destructive accessible transformation URLs
      const accessibleImageUrl = mediaService.generateImageTransformation(rawUpload.publicId, {
        preset: 'OCR_READY',
        width: 2000
      });

      // ----------------------------------------------------------------------
      // Step 6: Gemini Multimodal Processing
      // ----------------------------------------------------------------------
      await this._updateStatus(assetId, 'OCR_PROCESSING', {
        RAW_IMAGE_URL: rawUpload.secureUrl || rawUpload.url,
        RAW_IMAGE_PUBLIC_ID: rawUpload.publicId,
        PROCESSED_IMAGE_URL: processedUpload.secureUrl || processedUpload.url,
        PROCESSED_IMAGE_PUBLIC_ID: processedUpload.publicId,
        ACCESSIBLE_IMAGE_URL: accessibleImageUrl
      });
      await this._logAudit(assetId, 'GEMINI_MULTIMODAL_OCR', 'IN_PROGRESS', 60, null, userId);

      // Invoke Gemini multimodal API via integration layer
      const geminiResult = await this._invokeGeminiOcr(preprocessed.buffer, {
        title,
        subject,
        chapterTitle,
        entityId: assetId,
        mimeType: activeMime
      });

      // ----------------------------------------------------------------------
      // Step 7: Normalize & Validate Structured OCR Result
      // ----------------------------------------------------------------------
      const structuredResult = normalizeOcrResult(geminiResult, {
        title,
        isLowQuality,
        resolution: preprocessed.metadata.original
      });

      ocrValidator.validateStructuredResult(structuredResult);

      // ----------------------------------------------------------------------
      // Step 8: Persist Final Structured Results to Snowflake
      // ----------------------------------------------------------------------
      await this._updateStatus(assetId, 'COMPLETED', {
        OCR_EXTRACTED_TEXT: structuredResult.rawText,
        DIAGRAM_DESCRIPTIONS: structuredResult.diagramDescriptions,
        METADATA: {
          sections: structuredResult.sections,
          concepts: structuredResult.concepts,
          formulas: structuredResult.formulas,
          examples: structuredResult.examples,
          qualityMetrics: structuredResult.qualityMetrics,
          transformations: preprocessed.metadata.transformations
        },
        AI_METADATA: {
          confidenceScore: structuredResult.qualityMetrics.confidenceScore,
          isLowQuality,
          model: 'gemini-1.5-flash'
        },
        PROCESSING_COMPLETED_AT: new Date().toISOString()
      });

      await this._logAudit(assetId, 'OCR_PIPELINE_COMPLETE', 'SUCCESS', 100, null, userId);

      logger.info(`[OcrService] Successfully completed OCR pipeline for asset: ${assetId}`);

      return {
        success: true,
        assetId,
        status: 'COMPLETED',
        media: {
          rawImageUrl: rawUpload.secureUrl || rawUpload.url,
          processedImageUrl: processedUpload.secureUrl || processedUpload.url,
          accessibleImageUrl
        },
        structuredOcr: structuredResult
      };
    } catch (pipelineErr) {
      // ----------------------------------------------------------------------
      // Failure Handling: Persist Failure Information & Prevent Job Loss
      // ----------------------------------------------------------------------
      logger.error(`[OcrService] Pipeline failed for asset ${assetId}:`, { error: pipelineErr.message });

      try {
        await this._persistFailure(assetId, pipelineErr.message, userId);
      } catch (logErr) {
        logger.error('[OcrService] Failed to record failure state in Snowflake:', logErr.message);
      }

      throw pipelineErr;
    }
  }

  /**
   * Safely retries a failed OCR job
   *
   * @param {string} textbookAssetId - ID of the asset to retry
   * @param {Buffer} [imageBuffer] - Optional fresh buffer if re-uploading
   * @returns {Promise<object>} Result of retry
   */
  async retryProcessing(textbookAssetId, imageBuffer) {
    if (!textbookAssetId) {
      throw new Error('textbookAssetId is required to retry processing');
    }

    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ?',
      [textbookAssetId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Textbook asset not found for retry: ${textbookAssetId}`);
    }

    const asset = rows[0];
    const currentRetryCount = Number(asset.RETRY_COUNT || asset.retry_count || 0);

    logger.info(`[OcrService] Retrying failed OCR job: ${textbookAssetId} (Attempt #${currentRetryCount + 1})`);

    // Increment retry count in Snowflake
    await databaseManager.update(
      'TEXTBOOK_ASSETS',
      {
        RETRY_COUNT: currentRetryCount + 1,
        PROCESSING_STATUS: 'PREPROCESSING',
        ERROR_MESSAGE: null
      },
      'ID = ?',
      [textbookAssetId]
    );

    return this.processTextbookImage({
      buffer: imageBuffer,
      userId: asset.USER_ID || asset.user_id,
      title: asset.TITLE || asset.title,
      subject: asset.SUBJECT || asset.subject,
      chapterTitle: asset.CHAPTER_TITLE || asset.chapter_title,
      gradeLevel: asset.GRADE_LEVEL || asset.grade_level,
      textbookAssetId
    });
  }

  /**
   * Retrieve structured OCR result from Snowflake
   */
  async getOcrResult(textbookAssetId) {
    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ?',
      [textbookAssetId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    let metadata = {};
    if (row.METADATA) {
      try {
        metadata = typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA;
      } catch {
        metadata = {};
      }
    }

    let diagramDescriptions = [];
    if (row.DIAGRAM_DESCRIPTIONS) {
      try {
        diagramDescriptions = typeof row.DIAGRAM_DESCRIPTIONS === 'string'
          ? JSON.parse(row.DIAGRAM_DESCRIPTIONS)
          : row.DIAGRAM_DESCRIPTIONS;
      } catch {
        diagramDescriptions = [];
      }
    }

    return {
      assetId: row.ID,
      userId: row.USER_ID,
      title: row.TITLE,
      status: row.PROCESSING_STATUS,
      errorMessage: row.ERROR_MESSAGE,
      retryCount: row.RETRY_COUNT || 0,
      rawImageUrl: row.RAW_IMAGE_URL,
      processedImageUrl: row.PROCESSED_IMAGE_URL,
      accessibleImageUrl: row.ACCESSIBLE_IMAGE_URL,
      structuredOcr: {
        title: row.TITLE,
        rawText: row.OCR_EXTRACTED_TEXT,
        sections: metadata.sections || [],
        concepts: metadata.concepts || [],
        formulas: metadata.formulas || [],
        examples: metadata.examples || [],
        diagramDescriptions,
        qualityMetrics: metadata.qualityMetrics || {}
      }
    };
  }

  /**
   * Helper to invoke Gemini multimodal OCR
   * @private
   */
  async _invokeGeminiOcr(buffer, { title, subject, chapterTitle, entityId, mimeType = 'image/jpeg' }) {
    // Calls gemini multimodal integration
    const rawResult = await gemini.extractAndUnderstandTextbook(buffer, mimeType, entityId);

    // If result is already an object, return it
    if (rawResult && typeof rawResult === 'object') {
      return {
        title: rawResult.title || title,
        rawText: rawResult.extractedText || rawResult.rawText || '',
        sections: rawResult.sections || [],
        concepts: rawResult.concepts || (rawResult.keyTopics ? rawResult.keyTopics.map(t => ({ name: t, description: '' })) : []),
        formulas: rawResult.formulas || [],
        examples: rawResult.examples || [],
        diagramDescriptions: rawResult.diagramDescriptions || []
      };
    }

    return {
      title,
      rawText: String(rawResult),
      sections: [],
      concepts: [],
      formulas: [],
      examples: []
    };
  }

  /**
   * Helper to update status and attributes in Snowflake
   * @private
   */
  async _updateStatus(assetId, status, extraFields = {}) {
    const updatePayload = {
      PROCESSING_STATUS: status,
      ...extraFields
    };

    await databaseManager.update('TEXTBOOK_ASSETS', updatePayload, 'ID = ?', [assetId]);
  }

  /**
   * Helper to persist failure in Snowflake
   * @private
   */
  async _persistFailure(assetId, errorMessage, userId) {
    try {
      // 1. Fetch current retry count
      const rows = await databaseManager.query(
        'SELECT RETRY_COUNT FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ?',
        [assetId]
      );
      const currentRetry = rows.length > 0 ? (rows[0].RETRY_COUNT || 0) : 0;

      // 2. Mark FAILED in Snowflake
      await databaseManager.update(
        'TEXTBOOK_ASSETS',
        {
          PROCESSING_STATUS: 'FAILED',
          ERROR_MESSAGE: errorMessage,
          RETRY_COUNT: currentRetry + 1
        },
        'ID = ?',
        [assetId]
      );

      // 3. Log to AUDIT_LOGS
      await this._logAudit(assetId, 'OCR_PIPELINE_ERROR', 'FAILURE', 0, errorMessage, userId);
    } catch (err) {
      logger.error('[OcrService] Could not persist failure info to Snowflake:', err.message);
    }
  }

  /**
   * Helper to record audit log in Snowflake
   * @private
   */
  async _logAudit(assetId, action, status, progressPercent, errorMessage = null, userId = null) {
    try {
      await databaseManager.insert('AUDIT_LOGS', {
        ID: `log_${uuidv4()}`,
        USER_ID: userId,
        ENTITY_TYPE: 'TEXTBOOK',
        ENTITY_ID: assetId,
        ACTION: action,
        STATUS: status,
        PROGRESS_PERCENT: progressPercent,
        ERROR_MESSAGE: errorMessage,
        DETAILS: { timestamp: new Date().toISOString() }
      });
    } catch {
      // Audit log failures should not abort main flow
    }
  }
}

const ocrService = new OcrService();
module.exports = ocrService;
