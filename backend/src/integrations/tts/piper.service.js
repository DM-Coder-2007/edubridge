/**
 * EduBridge Adaptive - Piper TTS Service
 *
 * Business logic layer for local Piper neural text-to-speech:
 * 1. Sanitizes and prepares lesson text and adaptive explanations
 * 2. Manages temporary audio file lifecycle in local scratch storage
 * 3. Enforces guaranteed temporary file cleanup
 * 4. Supports WAV/MP3 pipeline with configurable voice and rate
 * 5. Strictly rejects cloud/paid TTS APIs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const piperClient = require('./piper.client');
const { stripXml, escapeXml } = require('../../utils/xml');
const logger = require('../../utils/logger');

class PiperService {
  /**
   * Preprocess and sanitize text for clean speech narration
   * Strips SSML / XML tags and cleans whitespace
   */
  prepareTextForSpeech(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('TTS Service: Input text must be a valid string.');
    }

    // Strip any HTML/XML/SSML tags that might confuse raw TTS
    let cleaned = stripXml(text);
    // Remove extra whitespace and line breaks
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    if (cleaned.length === 0) {
      throw new Error('TTS Service: Prepared text is empty after sanitization.');
    }

    return cleaned;
  }

  /**
   * Safely delete a temporary audio file from local disk
   * @param {string} filePath - Absolute path to temporary file
   */
  async cleanupTempFile(filePath) {
    if (!filePath) return;

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.debug(`[PiperService] Cleaned up temporary audio file: ${filePath}`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`[PiperService] Failed to delete temporary file "${filePath}": ${err.message}`);
      }
    }
  }

  /**
   * Synthesize speech and save to a temporary scratch file
   * Returns audio buffer, duration, and a bound cleanup function
   *
   * @param {string} text - Lesson text or explanation
   * @param {object} [options={}] - Options { voice, speakingRate, format }
   * @returns {Promise<{ tempFilePath: string, audioBuffer: Buffer, durationSeconds: number, format: string, fileSizeBytes: number, voice: string, speakingRate: number, cleanup: Function }>}
   */
  async synthesizeToTempFile(text, options = {}) {
    const sanitizedText = this.prepareTextForSpeech(text);
    const format = options.format || 'wav';

    // 1. Synthesize audio buffer via local Piper process
    const rawResult = await piperClient.synthesizeRaw(sanitizedText, options);
    const audioBuffer = rawResult.audioBuffer;

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('TTS synthesis failed: Piper generated an empty audio buffer (0 bytes).');
    }

    // 2. Write to temporary scratch file in os.tmpdir()
    const tempFileName = `edubridge_tts_${uuidv4()}.${format}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      await fs.promises.writeFile(tempFilePath, audioBuffer);
      logger.debug(`[PiperService] Temporary audio file written: ${tempFilePath} (${audioBuffer.length} bytes)`);
    } catch (writeErr) {
      logger.error('[PiperService] Failed to write temp audio file:', writeErr.message);
      throw new Error(`Failed to write local temporary audio file: ${writeErr.message}`);
    }

    const cleanup = async () => this.cleanupTempFile(tempFilePath);

    return {
      tempFilePath,
      audioBuffer,
      durationSeconds: rawResult.durationSeconds,
      format,
      fileSizeBytes: audioBuffer.length,
      voice: rawResult.voice,
      speakingRate: rawResult.speakingRate,
      cleanup
    };
  }

  /**
   * Execute an operation with a temporary audio file and ensure guaranteed cleanup
   *
   * @param {string} text - Text to synthesize
   * @param {object} options - Synthesis options
   * @param {Function} handler - Callback receiving { tempFilePath, audioBuffer, durationSeconds, ... }
   * @returns {Promise<any>}
   */
  async withTempAudioFile(text, options, handler) {
    const audioPackage = await this.synthesizeToTempFile(text, options);
    try {
      return await handler(audioPackage);
    } finally {
      // Guaranteed cleanup even if handler throws
      await audioPackage.cleanup();
    }
  }

  /**
   * Check local Piper availability
   */
  async checkAvailability() {
    return piperClient.checkAvailability();
  }
}

const piperService = new PiperService();
module.exports = piperService;
