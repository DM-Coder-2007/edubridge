/**
 * EduBridge Adaptive - AI Generation Metadata Repository (Snowflake)
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
    const record = {
      ID: id,
      ENTITY_TYPE: entityType,
      ENTITY_ID: entityId,
      MODEL_NAME: modelName,
      PROMPT_TOKENS: promptTokens,
      CANDIDATE_TOKENS: candidateTokens,
      TOTAL_TOKENS: totalTokens,
      LATENCY_MS: latencyMs,
      PROMPT_PREVIEW: promptPreview ? promptPreview.substring(0, 1000) : '',
      RAW_RESPONSE: typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse,
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('AI_GENERATION_METADATA', record);
    return this._format(record);
  }

  async getAuditForEntity(entityId) {
    const rows = await db.query(
      'SELECT * FROM AI_GENERATION_METADATA WHERE ENTITY_ID = ? ORDER BY CREATED_AT DESC',
      [entityId]
    );
    return rows.map(r => this._format(r));
  }

  _format(row) {
    if (!row) return null;
    return {
      id: row.ID,
      entityType: row.ENTITY_TYPE,
      entityId: row.ENTITY_ID,
      modelName: row.MODEL_NAME,
      promptTokens: parseInt(row.PROMPT_TOKENS || 0, 10),
      candidateTokens: parseInt(row.CANDIDATE_TOKENS || 0, 10),
      totalTokens: parseInt(row.TOTAL_TOKENS || 0, 10),
      latencyMs: parseInt(row.LATENCY_MS || 0, 10),
      promptPreview: row.PROMPT_PREVIEW,
      rawResponse: row.RAW_RESPONSE,
      createdAt: row.CREATED_AT
    };
  }
}

module.exports = new AIMetadataRepository();
