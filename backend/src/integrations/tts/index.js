/**
 * EduBridge Adaptive - Local Piper TTS Integration
 */

const piperClient = require('./piper.client');
const piperService = require('./piper.service');
const audioService = require('./audio.service');

module.exports = {
  piperClient,
  piperService,
  audioService,

  // Convenience methods
  synthesize: (text, options) => piperClient.synthesize(text, options),
  synthesizeRaw: (text, options) => piperClient.synthesizeRaw(text, options),
  synthesizeToTempFile: (text, options) => piperService.synthesizeToTempFile(text, options),
  generateSpeechAndUpload: (params) => audioService.generateSpeechAndUpload(params),
  generateLessonSummaryAudio: (params) => audioService.generateLessonSummaryAudio(params),
  generateAdaptiveExplanationAudio: (params) => audioService.generateAdaptiveExplanationAudio(params),
  checkTtsHealth: () => audioService.checkTtsHealth(),
  checkPiperHealth: () => audioService.checkTtsHealth()
};
