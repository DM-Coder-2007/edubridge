/**
 * EduBridge Adaptive - Lesson Repository (Snowflake)
 *
 * Dedicated data access layer for LESSONS table in Snowflake.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class LessonRepository {
  /**
   * Create an accessible lesson record in Snowflake
   * @param {object} lessonData
   * @returns {Promise<object>}
   */
  async create({
    id = null,
    textbookAssetId,
    textbookId, // Alias support
    userId,
    title,
    summary,
    simplifiedText,
    screenReaderTranscript = null,
    audioAssetId = null,
    audioUrl = null,
    audioPublicId = null,
    audioDurationSeconds = 0.0,
    waveformUrl = null,
    difficultyLevel = 'beginner',
    status = 'PUBLISHED',
    errorMessage = null,
    sensoryAnalogies = [],
    keyTakeaways = [],
    aiGenerationMetadata = {}
  }) {
    const lessonId = id || uuidv4();
    const assetId = textbookAssetId || textbookId;

    const record = {
      ID: lessonId,
      LESSON_ID: lessonId,
      TEXTBOOK_ASSET_ID: assetId,
      IMAGE_ID: assetId,
      USER_ID: userId,
      TITLE: title,
      SUMMARY: summary,
      SIMPLIFIED_TEXT: simplifiedText,
      SCREEN_READER_TRANSCRIPT: screenReaderTranscript || simplifiedText,
      AUDIO_ASSET_ID: audioAssetId,
      AUDIO_URL: audioUrl,
      AUDIO_PUBLIC_ID: audioPublicId,
      AUDIO_DURATION_SECONDS: parseFloat(audioDurationSeconds || 0.0),
      WAVEFORM_URL: waveformUrl,
      DIFFICULTY_LEVEL: difficultyLevel,
      DIFFICULTY: difficultyLevel,
      STATUS: status,
      PROCESSING_STATUS: 'COMPLETED',
      ERROR_MESSAGE: errorMessage,
      SENSORY_ANALOGIES: typeof sensoryAnalogies === 'string' ? sensoryAnalogies : JSON.stringify(sensoryAnalogies),
      KEY_TAKEAWAYS: typeof keyTakeaways === 'string' ? keyTakeaways : JSON.stringify(keyTakeaways),
      AI_GENERATION_METADATA: typeof aiGenerationMetadata === 'string' ? aiGenerationMetadata : JSON.stringify(aiGenerationMetadata),
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[LessonRepository] Inserting lesson "${title}" (${lessonId}) into Snowflake`);
    await db.insert('LESSONS', record);
    return this._format(record);
  }

  /**
   * Find lesson by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LESSONS WHERE ID = ? OR LESSON_ID = ? LIMIT 1', [id, id]);
    return this._format(row);
  }

  /**
   * Find all lessons belonging to a textbook asset
   * @param {string} textbookAssetId
   * @returns {Promise<Array<object>>}
   */
  async findByTextbookAssetId(textbookAssetId) {
    if (!textbookAssetId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LESSONS WHERE TEXTBOOK_ASSET_ID = ? OR IMAGE_ID = ? ORDER BY CREATED_AT ASC',
      [textbookAssetId, textbookAssetId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Backward compatibility alias
   */
  async findByTextbookId(textbookId) {
    return this.findByTextbookAssetId(textbookId);
  }

  /**
   * Find lessons created by or assigned to a user
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async findByUserId(userId) {
    if (!userId) return [];
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.LESSONS WHERE USER_ID = ? ORDER BY CREATED_AT DESC',
      [userId]
    );
    return rows.map(r => this._format(r));
  }

  /**
   * Update audio narration pointers and duration
   * @param {string} id
   * @param {object} audioFields
   * @returns {Promise<object|null>}
   */
  async updateAudio(id, { audioAssetId, audioUrl, audioPublicId, audioDurationSeconds, waveformUrl }) {
    const updates = {};
    if (audioAssetId) updates.AUDIO_ASSET_ID = audioAssetId;
    if (audioUrl) updates.AUDIO_URL = audioUrl;
    if (audioPublicId) updates.AUDIO_PUBLIC_ID = audioPublicId;
    if (audioDurationSeconds !== undefined) updates.AUDIO_DURATION_SECONDS = parseFloat(audioDurationSeconds);
    if (waveformUrl) updates.WAVEFORM_URL = waveformUrl;

    if (Object.keys(updates).length > 0) {
      await db.update('LESSONS', updates, 'ID = ? OR LESSON_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Update lesson status and error message
   * @param {string} id
   * @param {string} status
   * @param {string|null} [errorMessage=null]
   * @returns {Promise<object|null>}
   */
  async updateStatus(id, status, errorMessage = null) {
    const updates = { STATUS: status };
    if (errorMessage !== undefined) updates.ERROR_MESSAGE = errorMessage;
    await db.update('LESSONS', updates, 'ID = ? OR LESSON_ID = ?', [id, id]);
    return this.findById(id);
  }

  /**
   * Update lesson conceptual content
   * @param {string} id
   * @param {object} content
   * @returns {Promise<object|null>}
   */
  async updateContent(id, { title, summary, simplifiedText, sensoryAnalogies, keyTakeaways }) {
    const updates = {};
    if (title) updates.TITLE = title;
    if (summary) updates.SUMMARY = summary;
    if (simplifiedText) {
      updates.SIMPLIFIED_TEXT = simplifiedText;
      updates.SCREEN_READER_TRANSCRIPT = simplifiedText;
    }
    if (sensoryAnalogies) {
      updates.SENSORY_ANALOGIES = typeof sensoryAnalogies === 'string'
        ? sensoryAnalogies
        : JSON.stringify(sensoryAnalogies);
    }
    if (keyTakeaways) {
      updates.KEY_TAKEAWAYS = typeof keyTakeaways === 'string'
        ? keyTakeaways
        : JSON.stringify(keyTakeaways);
    }

    if (Object.keys(updates).length > 0) {
      await db.update('LESSONS', updates, 'ID = ? OR LESSON_ID = ?', [id, id]);
    }
    return this.findById(id);
  }

  /**
   * Delete lesson by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM EDUBRIDGE_ADAPTIVE.APP.LESSONS WHERE ID = ? OR LESSON_ID = ?', [id, id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;

    let analogies = [];
    if (row.SENSORY_ANALOGIES) {
      try {
        analogies = typeof row.SENSORY_ANALOGIES === 'string'
          ? JSON.parse(row.SENSORY_ANALOGIES)
          : row.SENSORY_ANALOGIES;
      } catch {
        analogies = [];
      }
    }

    let takeaways = [];
    if (row.KEY_TAKEAWAYS) {
      try {
        takeaways = typeof row.KEY_TAKEAWAYS === 'string'
          ? JSON.parse(row.KEY_TAKEAWAYS)
          : row.KEY_TAKEAWAYS;
      } catch {
        takeaways = [];
      }
    }

    let aiMeta = {};
    if (row.AI_GENERATION_METADATA) {
      try {
        aiMeta = typeof row.AI_GENERATION_METADATA === 'string'
          ? JSON.parse(row.AI_GENERATION_METADATA)
          : row.AI_GENERATION_METADATA;
      } catch {
        aiMeta = {};
      }
    }

    return {
      id: row.ID,
      textbookAssetId: row.TEXTBOOK_ASSET_ID || row.TEXTBOOK_ID,
      textbookId: row.TEXTBOOK_ID || row.TEXTBOOK_ASSET_ID,
      userId: row.USER_ID,
      title: row.TITLE,
      summary: row.SUMMARY,
      simplifiedText: row.SIMPLIFIED_TEXT,
      screenReaderTranscript: row.SCREEN_READER_TRANSCRIPT,
      audioAssetId: row.AUDIO_ASSET_ID,
      audioUrl: row.AUDIO_URL,
      audioPublicId: row.AUDIO_PUBLIC_ID,
      audioDurationSeconds: parseFloat(row.AUDIO_DURATION_SECONDS || 0.0),
      waveformUrl: row.WAVEFORM_URL,
      difficultyLevel: row.DIFFICULTY_LEVEL,
      status: row.STATUS,
      errorMessage: row.ERROR_MESSAGE,
      sensoryAnalogies: analogies,
      keyTakeaways: takeaways,
      aiGenerationMetadata: aiMeta,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const lessonRepository = new LessonRepository();
module.exports = lessonRepository;
