/**
 * EduBridge Adaptive - Speech Controller (faster-whisper)
 *
 * Handles HTTP requests for:
 * - POST /api/speech/transcribe
 *
 * CRITICAL ARCHITECTURE RULES:
 * - DO NOT use Google Speech Recognition or paid speech APIs. faster-whisper is mandatory.
 * - Do NOT permanently store raw microphone recordings on the application server.
 * - Temporary audio files are cleaned up immediately after transcription.
 * - Zero API secrets exposure.
 */

const { transcriptionService } = require('../integrations/speech');
const ApiResponse = require('../utils/apiResponse');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class SpeechController {
  /**
   * POST /api/speech/transcribe
   * Transcribe an uploaded voice audio recording using faster-whisper
   */
  async transcribe(req, res, next) {
    try {
      let audioBuffer = req.file ? req.file.buffer : null;
      let mimeType = req.file ? req.file.mimetype : 'audio/wav';

      if (!audioBuffer && req.body?.audioBase64) {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
        mimeType = req.body.mimeType || 'audio/wav';
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new ValidationError('Audio file is required for speech transcription. Upload via multipart form-data (field "audio") or provide "audioBase64".', {
          field: 'audio'
        });
      }

      const language = req.body?.language || 'en';
      const model = req.body?.model || null;

      logger.info(`[SpeechController] Processing speech transcription request (bytes=${audioBuffer.length}, lang=${language})`);

      const result = await transcriptionService.processVoiceAnswer(audioBuffer, {
        mimeType,
        language,
        model,
        userId: req.user ? req.user.id : null,
        storeRecording: false
      });

      return ApiResponse.success(res, 200, 'Speech transcribed successfully via faster-whisper', {
        transcript: result.transcript,
        confidence: result.confidence,
        durationSeconds: result.durationSeconds,
        language: result.language,
        timestamps: result.timestamps || []
      });
    } catch (error) {
      logger.error('[SpeechController] transcribe error:', error.message);
      next(error);
    }
  }
}

const speechController = new SpeechController();
module.exports = speechController;
