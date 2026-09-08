/**
 * EduBridge Adaptive - Media Repository (Snowflake)
 *
 * Dedicated data access layer for TEXTBOOK_ASSETS and media assets in Snowflake.
 * Tracks Cloudinary media pointers, image processing pipeline states, and OCR results.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class MediaRepository {
  /**
   * Create a new media asset record in Snowflake
   * @param {object} assetData
   * @returns {Promise<object>}
   */
  async create({
    userId,
    title,
    subject = 'General Education',
    gradeLevel = null,
    chapterTitle = null,
    rawImageUrl,
    rawImagePublicId,
    processedImageUrl = null,
    processedImagePublicId = null,
    accessibleImageUrl = null,
    accessibleImagePublicId = null,
    processingStatus = 'PENDING',
    metadata = {}
  }) {
    const id = `txt_${uuidv4()}`;
    const record = {
      ID: id,
      IMAGE_ID: id,
      USER_ID: userId,
      TITLE: title,
      SUBJECT: subject,
      GRADE_LEVEL: gradeLevel,
      CHAPTER_TITLE: chapterTitle,
      RAW_IMAGE_URL: rawImageUrl,
      RAW_IMAGE_PUBLIC_ID: rawImagePublicId,
      PROCESSED_IMAGE_URL: processedImageUrl,
      PROCESSED_IMAGE_PUBLIC_ID: processedImagePublicId,
      ACCESSIBLE_IMAGE_URL: accessibleImageUrl,
      ACCESSIBLE_IMAGE_PUBLIC_ID: accessibleImagePublicId,
      PROCESSING_STATUS: processingStatus,
      RETRY_COUNT: 0,
      ERROR_MESSAGE: null,
      PROCESSING_STARTED_AT: null,
      PROCESSING_COMPLETED_AT: null,
      OCR_EXTRACTED_TEXT: null,
      DIAGRAM_DESCRIPTIONS: JSON.stringify([]),
      METADATA: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      AI_METADATA: JSON.stringify({}),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[MediaRepository] Inserting media asset ${title} (${id}) into Snowflake`);
    await db.insert('TEXTBOOK_ASSETS', record);
    return this._format(record);
  }

  /**
   * Find media asset by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ? OR IMAGE_ID = ? LIMIT 1', [id, id]);
    return this._format(row);
  }

  /**
   * Find all media assets uploaded by a user
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async findByUserId(userId) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE USER_ID = ? ORDER BY CREATED_AT DESC',
      [userId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Update pipeline processing lifecycle status and error metrics
   * @param {string} id
   * @param {object} statusFields
   * @returns {Promise<object|null>}
   */
  async updateStatus(id, {
    status,
    retryCount,
    errorMessage = null,
    startedAt = null,
    completedAt = null
  }) {
    const updates = {};
    if (status) updates.PROCESSING_STATUS = status;
    if (retryCount !== undefined) updates.RETRY_COUNT = parseInt(retryCount, 10);
    if (errorMessage !== undefined) updates.ERROR_MESSAGE = errorMessage;
    if (startedAt) updates.PROCESSING_STARTED_AT = startedAt;
    if (completedAt) updates.PROCESSING_COMPLETED_AT = completedAt;

    if (Object.keys(updates).length > 0) {
      await db.update('TEXTBOOK_ASSETS', updates, 'ID = ? OR IMAGE_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Store structured OCR and multimodal analysis results
   * @param {string} id
   * @param {object} ocrData
   * @returns {Promise<object|null>}
   */
  async updateOcrResult(id, {
    ocrExtractedText,
    diagramDescriptions,
    aiMetadata,
    processedImageUrl,
    processedImagePublicId,
    accessibleImageUrl,
    accessibleImagePublicId
  }) {
    const updates = {};
    if (ocrExtractedText !== undefined) updates.OCR_EXTRACTED_TEXT = ocrExtractedText;
    if (diagramDescriptions) {
      updates.DIAGRAM_DESCRIPTIONS = typeof diagramDescriptions === 'string'
        ? diagramDescriptions
        : JSON.stringify(diagramDescriptions);
    }
    if (aiMetadata) {
      updates.AI_METADATA = typeof aiMetadata === 'string'
        ? aiMetadata
        : JSON.stringify(aiMetadata);
    }
    if (processedImageUrl) updates.PROCESSED_IMAGE_URL = processedImageUrl;
    if (processedImagePublicId) updates.PROCESSED_IMAGE_PUBLIC_ID = processedImagePublicId;
    if (accessibleImageUrl) updates.ACCESSIBLE_IMAGE_URL = accessibleImageUrl;
    if (accessibleImagePublicId) updates.ACCESSIBLE_IMAGE_PUBLIC_ID = accessibleImagePublicId;

    if (Object.keys(updates).length > 0) {
      await db.update('TEXTBOOK_ASSETS', updates, 'ID = ? OR IMAGE_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Delete media asset record by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ? OR IMAGE_ID = ?', [id, id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let meta = {};
    if (row.METADATA) {
      try {
        meta = typeof row.METADATA === 'string'
          ? JSON.parse(row.METADATA)
          : row.METADATA;
      } catch {
        meta = {};
      }
    }

    let diagrams = [];
    if (row.DIAGRAM_DESCRIPTIONS) {
      try {
        diagrams = typeof row.DIAGRAM_DESCRIPTIONS === 'string'
          ? JSON.parse(row.DIAGRAM_DESCRIPTIONS)
          : row.DIAGRAM_DESCRIPTIONS;
      } catch {
        diagrams = [];
      }
    }

    let aiMeta = {};
    if (row.AI_METADATA) {
      try {
        aiMeta = typeof row.AI_METADATA === 'string'
          ? JSON.parse(row.AI_METADATA)
          : row.AI_METADATA;
      } catch {
        aiMeta = {};
      }
    }

    return {
      id: row.ID || row.IMAGE_ID,
      imageId: row.IMAGE_ID || row.ID,
      userId: row.USER_ID,
      title: row.TITLE,
      subject: row.SUBJECT,
      gradeLevel: row.GRADE_LEVEL,
      chapterTitle: row.CHAPTER_TITLE,
      rawImageUrl: row.RAW_IMAGE_URL || row.ORIGINAL_URL,
      rawImagePublicId: row.RAW_IMAGE_PUBLIC_ID || row.CLOUDINARY_PUBLIC_ID,
      cloudinaryPublicId: row.CLOUDINARY_PUBLIC_ID || row.RAW_IMAGE_PUBLIC_ID,
      processedImageUrl: row.PROCESSED_IMAGE_URL || row.PROCESSED_URL,
      processedImagePublicId: row.PROCESSED_IMAGE_PUBLIC_ID,
      accessibleImageUrl: row.ACCESSIBLE_IMAGE_URL,
      accessibleImagePublicId: row.ACCESSIBLE_IMAGE_PUBLIC_ID,
      processingStatus: row.PROCESSING_STATUS,
      retryCount: parseInt(row.RETRY_COUNT || 0, 10),
      errorMessage: row.ERROR_MESSAGE,
      processingStartedAt: row.PROCESSING_STARTED_AT,
      processingCompletedAt: row.PROCESSING_COMPLETED_AT,
      ocrExtractedText: row.OCR_EXTRACTED_TEXT,
      diagramDescriptions: diagrams,
      metadata: meta,
      aiMetadata: aiMeta,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const mediaRepository = new MediaRepository();
module.exports = mediaRepository;
