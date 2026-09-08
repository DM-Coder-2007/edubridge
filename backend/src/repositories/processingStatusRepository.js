/**
 * EduBridge Adaptive - Processing Status Repository (Snowflake)
 * Mapped to EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

class ProcessingStatusRepository {
  async logStage({
    entityType,
    entityId,
    stage,
    status = 'PENDING',
    progressPercent = 0.0,
    errorMessage = null,
    metadata = {}
  }) {
    const id = uuidv4();
    const record = {
      ID: id,
      AUDIT_ID: id,
      ENTITY_TYPE: entityType,
      ENTITY_ID: entityId,
      ACTION: stage,
      STATUS: status,
      PROGRESS_PERCENT: parseFloat(progressPercent || 0.0),
      ERROR_MESSAGE: errorMessage,
      METADATA: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      DETAILS: stage,
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS', record);
    return this._format(record);
  }

  async create({ textbookId, currentStage = 'UPLOADED', progressPercentage = 0, errorMessage = null, metadata = {} }) {
    const res = await this.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbookId,
      stage: currentStage,
      status: 'IN_PROGRESS',
      progressPercent: progressPercentage,
      errorMessage,
      metadata
    });
    return {
      ...res,
      currentStage: res.stage,
      progressPercentage: res.progressPercent
    };
  }

  async update(textbookId, { currentStage, progressPercentage, status = 'IN_PROGRESS', errorMessage = null, metadata = {} }) {
    const res = await this.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbookId,
      stage: currentStage,
      status,
      progressPercent: progressPercentage,
      errorMessage,
      metadata
    });
    return {
      ...res,
      currentStage: res.stage,
      progressPercentage: res.progressPercent
    };
  }

  async getLatestForEntity(entityId) {
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS WHERE ENTITY_ID = ? ORDER BY CREATED_AT DESC LIMIT 1',
      [entityId]
    );
    return this._format(row);
  }

  async getAllForEntity(entityId) {
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS WHERE ENTITY_ID = ? ORDER BY CREATED_AT ASC',
      [entityId]
    );
    return rows.map(r => this._format(r));
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
      id: row.ID || row.AUDIT_ID,
      entityType: row.ENTITY_TYPE,
      entityId: row.ENTITY_ID,
      stage: row.ACTION || row.STAGE,
      action: row.ACTION,
      status: row.STATUS,
      progressPercent: parseFloat(row.PROGRESS_PERCENT || 0),
      errorMessage: row.ERROR_MESSAGE,
      metadata: meta,
      createdAt: row.CREATED_AT
    };
  }
}

module.exports = new ProcessingStatusRepository();
