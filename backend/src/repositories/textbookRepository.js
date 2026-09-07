/**
 * EduBridge Adaptive - Textbook Repository (Snowflake)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

class TextbookRepository {
  async create({
    userId,
    title,
    subject,
    gradeLevel = null,
    chapterTitle = null,
    rawImageUrl,
    rawImagePublicId,
    processedImageUrl = null,
    processedImagePublicId = null,
    processingStatus = 'UPLOADED',
    metadata = {}
  }) {
    const id = uuidv4();
    const record = {
      ID: id,
      USER_ID: userId,
      TITLE: title,
      SUBJECT: subject,
      GRADE_LEVEL: gradeLevel,
      CHAPTER_TITLE: chapterTitle,
      RAW_IMAGE_URL: rawImageUrl,
      RAW_IMAGE_PUBLIC_ID: rawImagePublicId,
      PROCESSED_IMAGE_URL: processedImageUrl,
      PROCESSED_IMAGE_PUBLIC_ID: processedImagePublicId,
      PROCESSING_STATUS: processingStatus,
      METADATA: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    await db.insert('TEXTBOOKS', record);
    return this._format(record);
  }

  async createTextbook(params) {
    return this.create(params);
  }

  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM TEXTBOOKS WHERE ID = ? LIMIT 1', [id]);
    return this._format(row);
  }

  async findByUserId(userId) {
    if (!userId) return [];
    const rows = await db.query('SELECT * FROM TEXTBOOKS WHERE USER_ID = ? ORDER BY CREATED_AT DESC', [userId]);
    return rows.map(r => this._format(r));
  }

  async updateProcessingStatus(id, status, extraFields = {}) {
    const updates = { PROCESSING_STATUS: status };
    if (extraFields.processedImageUrl) updates.PROCESSED_IMAGE_URL = extraFields.processedImageUrl;
    if (extraFields.processedImagePublicId) updates.PROCESSED_IMAGE_PUBLIC_ID = extraFields.processedImagePublicId;
    if (extraFields.metadata) updates.METADATA = JSON.stringify(extraFields.metadata);

    await db.update('TEXTBOOKS', updates, 'ID = ?', [id]);
    return this.findById(id);
  }

  async delete(id, userId) {
    const res = await db.query('DELETE FROM TEXTBOOKS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return res;
  }

  _format(row) {
    if (!row) return null;
    let meta = {};
    if (row.METADATA) {
      try {
        meta = typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA;
      } catch {
        meta = {};
      }
    }

    return {
      id: row.ID,
      userId: row.USER_ID,
      title: row.TITLE,
      subject: row.SUBJECT,
      gradeLevel: row.GRADE_LEVEL,
      chapterTitle: row.CHAPTER_TITLE,
      rawImageUrl: row.RAW_IMAGE_URL,
      rawImagePublicId: row.RAW_IMAGE_PUBLIC_ID,
      processedImageUrl: row.PROCESSED_IMAGE_URL,
      processedImagePublicId: row.PROCESSED_IMAGE_PUBLIC_ID,
      processingStatus: row.PROCESSING_STATUS,
      metadata: meta,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

module.exports = new TextbookRepository();
