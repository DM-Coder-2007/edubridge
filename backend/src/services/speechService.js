/**
 * EduBridge Adaptive - Speech Recognition Service (faster-whisper)
 */

const whisper = require('../integrations/whisper');
const logger = require('../utils/logger');

class SpeechService {
  async transcribeVoiceAnswer(audioBuffer, language = 'en') {
    logger.info(`[SpeechService] Transcribing student voice answer (${(audioBuffer.length / 1024).toFixed(1)}KB)`);
    return whisper.transcribe(audioBuffer, language);
  }
}

module.exports = new SpeechService();
