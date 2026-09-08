/**
 * EduBridge Adaptive - Audio Repository (Snowflake)
 *
 * Dedicated data access layer for AUDIO_ASSETS table in Snowflake.
 * Tracks synthesized Piper TTS narrations, audio durations, Cloudinary references, and waveforms.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class AudioRepository {
  /**
   * Create a new audio asset record in Snowflake
   * @param {object} audioData
   * @returns {Promise<object>}
   */
  async create({
    userId = null,
    lessonId = null,
    entityType = 'LESSON',
    entityId,
    audioUrl,
    audioPublicId,
    audioFormat = 'mp3',
    durationSeconds = 0.0,
    fileSizeBytes = null,
    bitrateKbps = 128,
    speechRate = 1.00,
    waveformUrl = null,
    waveformData = null,
    voiceId = 'en_US-lessac-medium',
    ttsEngine = 'PIPER_TTS',
    status = 'COMPLETED',
    metadata = {}
  }) {
    const id = `aud_${uuidv4()}`;
    const record = {
      ID: id,
      AUDIO_ID: id,
      USER_ID: userId,
      LESSON_ID: lessonId || entityId || null,
      ENTITY_TYPE: String(entityType || 'LESSON').toUpperCase(),
      ENTITY_ID: entityId || lessonId,
      AUDIO_URL: audioUrl,
      AUDIO_PUBLIC_ID: audioPublicId,
      CLOUDINARY_PUBLIC_ID: audioPublicId,
      AUDIO_FORMAT: audioFormat,
      FORMAT: audioFormat,
      DURATION_SECONDS: parseFloat(durationSeconds || 0.0),
      FILE_SIZE_BYTES: fileSizeBytes ? parseInt(fileSizeBytes, 10) : null,
      BITRATE_KBPS: parseInt(bitrateKbps || 128, 10),
      SPEECH_RATE: parseFloat(speechRate || 1.00),
      WAVEFORM_URL: waveformUrl,
      WAVEFORM_DATA: typeof waveformData === 'string'
        ? waveformData
        : (waveformData ? JSON.stringify(waveformData) : null),
      VOICE: voiceId,
      VOICE_ID: voiceId,
      TTS_ENGINE: ttsEngine,
      STATUS: status,
      RETRY_COUNT: 0,
      ERROR_MESSAGE: null,
      METADATA: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[AudioRepository] Inserting audio asset for ${entityType}:${entityId} (${id})`);
    await db.insert('EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS', record);
    return this._format(record);
  }

  /**
   * Find audio asset by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE ID = ? OR AUDIO_ID = ? LIMIT 1', [id, id]);
    return this._format(row);
  }

  /**
   * Find audio asset associated with a specific entity (e.g. LESSON, QUESTION)
   * @param {string} entityType - 'LESSON', 'QUESTION', 'FEEDBACK'
   * @param {string} entityId
   * @returns {Promise<object|null>}
   */
  async findByEntity(entityType, entityId) {
    if (!entityType || !entityId) return null;
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE (ENTITY_TYPE = ? AND ENTITY_ID = ?) OR LESSON_ID = ? ORDER BY CREATED_AT DESC LIMIT 1',
      [String(entityType).toUpperCase(), entityId, entityId]
    );
    return this._format(row);
  }

  /**
   * Find audio asset by entity ID
   * @param {string} entityId
   * @returns {Promise<object|null>}
   */
  async findByEntityId(entityId) {
    if (!entityId) return null;
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE ENTITY_ID = ? OR LESSON_ID = ? ORDER BY CREATED_AT DESC LIMIT 1',
      [entityId, entityId]
    );
    return this._format(row);
  }

  /**
   * Find audio asset by Cloudinary public ID
   * @param {string} audioPublicId
   * @returns {Promise<object|null>}
   */
  async findByPublicId(audioPublicId) {
    if (!audioPublicId) return null;
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE AUDIO_PUBLIC_ID = ? OR CLOUDINARY_PUBLIC_ID = ? LIMIT 1',
      [audioPublicId, audioPublicId]
    );
    return this._format(row);
  }

  /**
   * Update precomputed waveform visualization URL and JSON peaks
   * @param {string} id
   * @param {object} waveformFields
   * @returns {Promise<object|null>}
   */
  async updateWaveform(id, { waveformUrl, waveformData }) {
    const updates = {};
    if (waveformUrl) updates.WAVEFORM_URL = waveformUrl;
    if (waveformData) {
      updates.WAVEFORM_DATA = typeof waveformData === 'string'
        ? waveformData
        : JSON.stringify(waveformData);
    }

    if (Object.keys(updates).length > 0) {
      await db.update('EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS', updates, 'ID = ? OR AUDIO_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Update audio generation lifecycle status
   * @param {string} id
   * @param {object} statusFields
   * @returns {Promise<object|null>}
   */
  async updateStatus(id, { status, errorMessage = null, retryCount }) {
    const updates = {};
    if (status) updates.STATUS = status;
    if (errorMessage !== undefined) updates.ERROR_MESSAGE = errorMessage;
    if (retryCount !== undefined) updates.RETRY_COUNT = parseInt(retryCount, 10);

    if (Object.keys(updates).length > 0) {
      await db.update('EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS', updates, 'ID = ? OR AUDIO_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Delete audio asset record by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE ID = ? OR AUDIO_ID = ?', [id, id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let waveform = null;
    if (row.WAVEFORM_DATA) {
      try {
        waveform = typeof row.WAVEFORM_DATA === 'string'
          ? JSON.parse(row.WAVEFORM_DATA)
          : row.WAVEFORM_DATA;
      } catch {
        waveform = null;
      }
    }

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

    return {
      id: row.ID || row.AUDIO_ID,
      audioId: row.AUDIO_ID || row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID || row.ENTITY_ID,
      entityType: row.ENTITY_TYPE,
      entityId: row.ENTITY_ID,
      audioUrl: row.AUDIO_URL,
      audioPublicId: row.AUDIO_PUBLIC_ID,
      cloudinaryPublicId: row.AUDIO_PUBLIC_ID || row.CLOUDINARY_PUBLIC_ID,
      audioFormat: row.AUDIO_FORMAT || row.FORMAT,
      format: row.AUDIO_FORMAT || row.FORMAT,
      durationSeconds: parseFloat(row.DURATION_SECONDS || 0.0),
      duration: parseFloat(row.DURATION_SECONDS || 0.0),
      fileSizeBytes: row.FILE_SIZE_BYTES ? parseInt(row.FILE_SIZE_BYTES, 10) : null,
      bitrateKbps: parseInt(row.BITRATE_KBPS || 128, 10),
      speechRate: parseFloat(row.SPEECH_RATE || 1.00),
      waveformUrl: row.WAVEFORM_URL,
      waveformData: waveform,
      voiceId: row.VOICE_ID,
      ttsEngine: row.TTS_ENGINE,
      status: row.STATUS,
      retryCount: parseInt(row.RETRY_COUNT || 0, 10),
      errorMessage: row.ERROR_MESSAGE,
      metadata: meta,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const audioRepository = new AudioRepository();
module.exports = audioRepository;
