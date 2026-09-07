/**
 * EduBridge Adaptive - End-to-End Audio Narration Service
 *
 * Full pipeline orchestrator:
 * Express -> TTS Service -> Piper -> Audio File -> Cloudinary -> Snowflake Metadata
 *
 * CRITICAL ARCHITECTURE RULES:
 * 1. DO NOT permanently store generated audio on the application server.
 *    Upload generated audio to Cloudinary and immediately delete local temporary files.
 * 2. Snowflake MUST store:
 *    - audio_id
 *    - lesson_id
 *    - user_id
 *    - cloudinary_public_id
 *    - audio_url
 *    - duration
 *    - voice
 *    - format
 *    - created_at
 * 3. Never report TTS success unless actual audio generation succeeds.
 * 4. Local Piper TTS strictly replaces Google Cloud TTS and all paid APIs.
 */

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const piperService = require('./piper.service');
const mediaService = require('../../services/media/media.service');
const databaseManager = require('../../database/snowflake/databaseManager');
const logger = require('../../utils/logger');

class AudioService {
  /**
   * Synthesize audio from text, upload to Cloudinary, remove local scratch file,
   * and persist canonical metadata to Snowflake.
   *
   * @param {object} params
   * @param {string} params.text - Clean speech text to synthesize
   * @param {string} [params.entityType='LESSON'] - Entity type ('LESSON', 'SUMMARY', 'EXPLANATION')
   * @param {string} [params.entityId] - Target entity identifier
   * @param {string} [params.lessonId] - Associated lesson ID
   * @param {string} [params.userId] - Student or creator user ID
   * @param {string} [params.voice] - Piper neural voice name
   * @param {number} [params.speakingRate=1.0] - Speech rate multiplier (0.5 - 2.0)
   * @param {string} [params.format='wav'] - Audio format ('wav' or 'mp3')
   * @param {string} [params.folder] - Custom Cloudinary destination folder
   * @returns {Promise<object>} Full audio descriptor stored in Snowflake
   */
  async generateSpeechAndUpload({
    text,
    entityType = 'LESSON',
    entityId = null,
    lessonId = null,
    userId = null,
    voice = null,
    speakingRate = 1.0,
    format = 'wav',
    folder = null
  }) {
    logger.info(`[AudioService] Initiating speech synthesis for entity=${entityType}:${entityId || lessonId}`);

    // 1. Synthesize audio to a local temporary scratch file
    const audioPackage = await piperService.synthesizeToTempFile(text, {
      voice,
      speakingRate,
      format
    });

    const { tempFilePath, audioBuffer, durationSeconds, voice: activeVoice } = audioPackage;

    // 2. Validate that audio was genuinely generated before declaring any success
    if (!audioBuffer || audioBuffer.length === 0) {
      await audioPackage.cleanup();
      throw new Error('TTS Service failure: Audio synthesis produced 0 bytes of audio.');
    }

    let uploadResult;
    try {
      // 3. Upload generated audio to Cloudinary
      const targetFolder = folder || (entityType === 'EXPLANATION' ? 'edubridge/audio/explanations' : 'edubridge/audio/lessons');
      const publicId = `audio_${entityType.toLowerCase()}_${entityId || lessonId || uuidv4()}`;
      const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

      uploadResult = await mediaService.uploadAudio(audioBuffer, {
        folder: targetFolder,
        publicId,
        userId,
        lessonId,
        duration: durationSeconds,
        mimeType,
        tags: ['tts', 'piper', entityType.toLowerCase()]
      });

      logger.info(`[AudioService] Audio uploaded to Cloudinary: ${uploadResult.publicId} (${uploadResult.secureUrl || uploadResult.url})`);
    } catch (uploadErr) {
      logger.error('[AudioService] Cloudinary audio upload failed:', uploadErr.message);
      throw new Error(`Cloudinary audio upload failed: ${uploadErr.message}`);
    } finally {
      // 4. CRITICAL: Remove temporary local audio file immediately!
      // Audio must NEVER permanently reside on the application server.
      await audioPackage.cleanup();

      // Double-check file deletion for diagnostic safety
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Non-blocking cleanup fallback
        }
      }
    }

    // 5. Persist canonical metadata to Snowflake AUDIO_ASSETS table
    const audioId = `aud_${uuidv4()}`;
    const nowIso = new Date().toISOString();
    const finalUrl = uploadResult.secureUrl || uploadResult.url;
    const finalPublicId = uploadResult.publicId;

    const audioMetadata = {
      audio_id: audioId,
      lesson_id: lessonId || entityId || null,
      user_id: userId || null,
      cloudinary_public_id: finalPublicId,
      audio_url: finalUrl,
      duration: durationSeconds,
      voice: activeVoice,
      format,
      created_at: nowIso
    };

    const snowflakeRecord = {
      ID: audioId,
      ENTITY_TYPE: entityType,
      ENTITY_ID: entityId || lessonId || audioId,
      AUDIO_URL: finalUrl,
      AUDIO_PUBLIC_ID: finalPublicId,
      AUDIO_FORMAT: format,
      DURATION_SECONDS: durationSeconds,
      FILE_SIZE_BYTES: audioBuffer.length,
      VOICE_ID: activeVoice,
      TTS_ENGINE: 'PIPER_TTS',
      STATUS: 'COMPLETED',
      METADATA: audioMetadata,
      CREATED_AT: nowIso,
      UPDATED_AT: nowIso
    };

    try {
      await databaseManager.insert('AUDIO_ASSETS', snowflakeRecord);
      logger.info(`[AudioService] Saved audio metadata to Snowflake AUDIO_ASSETS for ID: ${audioId}`);
    } catch (dbErr) {
      logger.error('[AudioService] Failed to persist audio metadata to Snowflake:', dbErr.message);
      throw new Error(`Snowflake audio metadata persistence failed: ${dbErr.message}`);
    }

    // 6. Return standard descriptor
    return {
      success: true,
      audioId,
      lessonId: lessonId || entityId || null,
      userId: userId || null,
      cloudinaryPublicId: finalPublicId,
      audioUrl: finalUrl,
      duration: durationSeconds,
      voice: activeVoice,
      format,
      fileSizeBytes: audioBuffer.length,
      createdAt: nowIso,
      ttsEngine: 'PIPER_TTS',
      tempFileCleaned: !fs.existsSync(tempFilePath)
    };
  }

  /**
   * Synthesize audio for lesson summary and persist metadata
   */
  async generateLessonSummaryAudio({ lessonId, userId = null, text, voice = null, speakingRate = 1.0, format = 'wav' }) {
    if (!lessonId) throw new Error('lessonId is required for lesson summary audio.');
    if (!text) throw new Error('text is required for lesson summary audio.');

    return this.generateSpeechAndUpload({
      text,
      entityType: 'SUMMARY',
      entityId: lessonId,
      lessonId,
      userId,
      voice,
      speakingRate,
      format,
      folder: 'edubridge/audio/summaries'
    });
  }

  /**
   * Synthesize audio for adaptive explanation or sensory analogy and persist metadata
   */
  async generateAdaptiveExplanationAudio({ lessonId = null, userId = null, text, conceptId = null, voice = null, speakingRate = 1.0, format = 'wav' }) {
    if (!text) throw new Error('text is required for adaptive explanation audio.');

    return this.generateSpeechAndUpload({
      text,
      entityType: 'EXPLANATION',
      entityId: conceptId || lessonId || `exp_${uuidv4()}`,
      lessonId,
      userId,
      voice,
      speakingRate,
      format,
      folder: 'edubridge/audio/explanations'
    });
  }

  /**
   * Retrieve audio metadata from Snowflake by audio ID
   */
  async getAudioMetadata(audioId) {
    if (!audioId) return null;

    const rows = await databaseManager.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE ID = ? LIMIT 1',
      [audioId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    let meta = {};
    if (row.METADATA) {
      try {
        meta = typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA;
      } catch {
        meta = {};
      }
    }

    return {
      audioId: row.ID,
      entityType: row.ENTITY_TYPE,
      entityId: row.ENTITY_ID,
      audioUrl: row.AUDIO_URL,
      cloudinaryPublicId: row.AUDIO_PUBLIC_ID,
      duration: parseFloat(row.DURATION_SECONDS || 0),
      voice: row.VOICE_ID,
      format: row.AUDIO_FORMAT,
      status: row.STATUS,
      metadata: meta,
      createdAt: row.CREATED_AT
    };
  }

  /**
   * Check TTS pipeline health
   */
  async checkTtsHealth() {
    const piperHealth = await piperService.checkAvailability();
    const mediaHealth = await mediaService.checkCloudinaryHealth();

    return {
      status: piperHealth.available && mediaHealth.connected ? 'healthy' : 'degraded',
      engine: 'PIPER_TTS',
      piper: piperHealth,
      cloudinary: mediaHealth
    };
  }
}

const audioService = new AudioService();
module.exports = audioService;
