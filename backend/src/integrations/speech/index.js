/**
 * EduBridge Adaptive - Speech Recognition Module (faster-whisper)
 */

const whisperClient = require('./whisper.client');
const transcriptionService = require('./transcription.service');

module.exports = {
  whisperClient,
  transcriptionService,

  // Convenience methods
  transcribe: (buffer, options) => transcriptionService.transcribeVoiceAnswer(buffer, options),
  processVoiceAnswer: (buffer, options) => transcriptionService.processVoiceAnswer(buffer, options),
  checkSpeechHealth: () => transcriptionService.checkSpeechHealth()
};
