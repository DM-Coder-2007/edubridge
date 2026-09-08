/**
 * EduBridge Adaptive - AI Generation Metadata Repository (Snowflake)
 * Mapped to EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

class AIMetadataRepository {
  async record({
    entityType,
    entityId,
    modelName,
    promptTokens = 0,
    candidateTokens = 0,
    totalTokens = 0,
    latencyMs = 0,
    promptPreview = '',
    rawResponse = ''
  }) {
    const id = uuidv4();
    const metaObj = {
      modelName,
      promptTokens,
      candidateTokens,
      totalTokens,
      rawResponse: typeof rawResponse === 'object' ? rawResponse : String(rawResponse || '')
    };

    const record = {
      ID: id,
      AUDIT_ID: id,
      ENTITY_TYPE: entityType,
      ENTITY_ID: entityId,
      ACTION: 'AI_GENERATION',
      STATUS: 'COMPLETED',
      EXECUTION_TIME_MS: parseInt(latencyMs || 0, 10),
      DETAILS: promptPreview ? promptPreview.substring(0, 1000) : '',
      METADATA: JSON.stringify(metaObj),
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS', record);
    return this._format(record);
  }

  async getAuditForEntity(entityId) {
    const rows = await db.query(
      "SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS WHERE ENTITY_ID = ? AND ACTION = 'AI_GENERATION' ORDER BY CREATED_AT DESC",
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
      modelName: meta.modelName || 'gemini-3-flash-preview',
      promptTokens: parseInt(meta.promptTokens || 0, 10),
      candidateTokens: parseInt(meta.candidateTokens || 0, 10),
      totalTokens: parseInt(meta.totalTokens || 0, 10),
      latencyMs: parseInt(row.EXECUTION_TIME_MS || 0, 10),
      promptPreview: row.DETAILS || '',
      rawResponse: meta.rawResponse || '',
      createdAt: row.CREATED_AT
    };
  }
}

module.exports = new AIMetadataRepository();
