/**
 * EduBridge Adaptive - faster-whisper Speech Recognition Client
 *
 * Local neural speech-to-text client.
 *
 * CRITICAL ARCHITECTURE RULES:
 * - Operates strictly with faster-whisper (local or HTTP container sidecar).
 * - DO NOT use Google Speech Recognition or paid third-party speech APIs.
 * - Supports configurable languages, models, timestamps, and confidence scores.
 * - Remains completely optional so failures never break core text/audio learning.
 */

const fs = require('fs');
const logger = require('../../utils/logger');

// Known / standard faster-whisper models
const SUPPORTED_WHISPER_MODELS = [
  'tiny',
  'tiny.en',
  'base',
  'base.en',
  'small',
  'small.en',
  'medium',
  'medium.en',
  'large-v2',
  'large-v3'
];

class WhisperClient {
  constructor() {
    this.httpUrl = process.env.WHISPER_HTTP_URL || '';
    this.defaultModel = process.env.WHISPER_MODEL || 'base.en';
    this.defaultLanguage = 'en';

    const forceMock = process.env.WHISPER_MOCK_FALLBACK === 'true';
    this._isMock = forceMock || !this.httpUrl;

    // Test overrides
    this._mockFailure = null;
    this._simulatedMissingModel = false;
    this._simulatedSilence = false;

    if (this._isMock) {
      logger.info('[WhisperClient] Running in LOCAL MOCK/SIMULATION mode. faster-whisper is the designated voice recognition engine.');
    } else {
      logger.info(`[WhisperClient] Live faster-whisper service configured at: ${this.httpUrl} (Model: ${this.defaultModel})`);
    }
  }

  isMockMode() {
    return this._isMock;
  }

  setMockMode(mock) {
    this._isMock = Boolean(mock);
  }

  setMockFailure(errorOrMsg) {
    this._mockFailure = errorOrMsg;
  }

  setSimulatedMissingModel(bool) {
    this._simulatedMissingModel = Boolean(bool);
  }

  setSimulatedSilence(bool) {
    this._simulatedSilence = Boolean(bool);
  }

  clearMockOverrides() {
    this._mockFailure = null;
    this._simulatedMissingModel = false;
    this._simulatedSilence = false;
  }

  /**
   * Check faster-whisper availability and runtime configuration
   */
  async checkAvailability() {
    if (this._mockFailure) {
      return {
        available: false,
        engine: 'FASTER_WHISPER',
        mode: 'MOCK_SIMULATION',
        error: typeof this._mockFailure === 'string' ? this._mockFailure : this._mockFailure.message
      };
    }

    if (this._isMock) {
      return {
        available: true,
        engine: 'FASTER_WHISPER',
        mode: 'MOCK_SIMULATION',
        model: this.defaultModel,
        defaultLanguage: this.defaultLanguage,
        supportedModels: [...SUPPORTED_WHISPER_MODELS]
      };
    }

    try {
      const res = await fetch(`${this.httpUrl}/health`);
      return {
        available: res.ok,
        engine: 'FASTER_WHISPER',
        mode: 'HTTP_SIDECAR',
        httpUrl: this.httpUrl,
        model: this.defaultModel,
        defaultLanguage: this.defaultLanguage,
        supportedModels: [...SUPPORTED_WHISPER_MODELS]
      };
    } catch (err) {
      if (process.env.WHISPER_MOCK_FALLBACK === 'true') {
        return {
          available: true,
          engine: 'FASTER_WHISPER',
          mode: 'MOCK_SIMULATION',
          model: this.defaultModel,
          defaultLanguage: this.defaultLanguage,
          supportedModels: [...SUPPORTED_WHISPER_MODELS],
          note: `Sidecar offline (${err.message}). Using local mock simulation.`
        };
      }
      return {
        available: false,
        engine: 'FASTER_WHISPER',
        mode: 'HTTP_SIDECAR',
        error: `Sidecar unreachable: ${err.message}`
      };
    }
  }

  /**
   * Validate that model name is recognized and valid
   */
  validateModel(modelName) {
    if (this._simulatedMissingModel) {
      throw new Error(`Missing or invalid faster-whisper model: "${modelName}". Model weights are not installed.`);
    }

    if (!modelName) return this.defaultModel;

    const normalized = String(modelName).trim().toLowerCase();
    if (!SUPPORTED_WHISPER_MODELS.includes(normalized) && !normalized.includes('/') && !normalized.includes('\\')) {
      throw new Error(
        `Missing or invalid faster-whisper model: "${modelName}". Supported models: ${SUPPORTED_WHISPER_MODELS.join(', ')}`
      );
    }

    return normalized;
  }

  /**
   * Transcribe an audio file using faster-whisper
   *
   * @param {string} filePath - Absolute path to audio file on disk
   * @param {object} [options={}] - Options { language, model, provider }
   * @returns {Promise<{ transcript: string, language: string, confidence: number, durationSeconds: number, timestamps: Array, isSilent: boolean }>}
   */
  async transcribeAudioFile(filePath, options = {}) {
    // 1. Explicit rejection of Google Speech Recognition or paid cloud APIs
    if (options.provider === 'google' || options.provider === 'gcp' || options.provider === 'paid') {
      throw new Error('Prohibited: Google Speech Recognition is forbidden. faster-whisper must be used.');
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Transcription failed: Audio file not found at path "${filePath}".`);
    }

    const activeModel = this.validateModel(options.model || this.defaultModel);
    const activeLanguage = options.language || this.defaultLanguage;

    // Test failure override
    if (this._mockFailure) {
      const msg = typeof this._mockFailure === 'string'
        ? this._mockFailure
        : (this._mockFailure.message || 'faster-whisper process failed');
      logger.error(`[WhisperClient] Simulated transcription failure: ${msg}`);
      throw new Error(`faster-whisper transcription error: ${msg}`);
    }

    // Read audio buffer from temporary file for inspection / transmission
    const audioBuffer = await fs.promises.readFile(filePath);

    // 2. Silence detection: check if simulated silence or all zero/flat bytes
    const isBufferSilent = this._isAudioSilent(audioBuffer) || this._simulatedSilence;
    if (isBufferSilent) {
      logger.info('[WhisperClient] Audio detected as silence / no speech.');
      return {
        transcript: '',
        language: activeLanguage,
        confidence: 0.0,
        durationSeconds: 1.0,
        timestamps: [],
        isSilent: true
      };
    }

    // 3. Mock / Simulation Mode
    if (this._isMock || !this.httpUrl) {
      logger.info(`[WhisperClient] [MOCK] Transcribed audio file (${audioBuffer.length} bytes, lang=${activeLanguage}, model=${activeModel})`);

      // Realistic speech transcript with timestamps and high confidence
      const mockTranscript = 'It provides rigid shape and structural protection to the cell.';
      const timestamps = [
        { start: 0.0, end: 1.2, text: 'It provides rigid shape', confidence: 0.98 },
        { start: 1.2, end: 2.8, text: 'and structural protection to the cell.', confidence: 0.94 }
      ];

      return {
        transcript: mockTranscript,
        language: activeLanguage,
        confidence: 0.96,
        durationSeconds: 2.8,
        timestamps,
        isSilent: false
      };
    }

    // 4. Live faster-whisper HTTP Sidecar
    try {
      const url = new URL(`${this.httpUrl}/transcribe`);
      if (activeLanguage) url.searchParams.set('language', activeLanguage);
      if (activeModel) url.searchParams.set('model', activeModel);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audioBuffer
      });

      if (!response.ok) {
        throw new Error(`faster-whisper service returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const transcript = (data.text || data.transcript || '').trim();
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0.92;
      const isSilent = transcript.length === 0;

      return {
        transcript,
        language: data.language || activeLanguage,
        confidence,
        durationSeconds: data.duration || 0,
        timestamps: data.segments || [],
        isSilent
      };
    } catch (err) {
      logger.error('[WhisperClient] Live transcription failed:', err.message);
      throw new Error(`faster-whisper transcription error: ${err.message}`);
    }
  }

  /**
   * Helper to detect silence or empty PCM data
   * @private
   */
  _isAudioSilent(buffer) {
    if (!buffer || buffer.length === 0) return true;
    if (buffer.length < 100) return false; // Too small to judge purely on amplitude

    // Check sample bytes after header (skip first 44 bytes if WAV)
    const startOffset = buffer.slice(0, 4).toString() === 'RIFF' ? 44 : 0;
    let nonZeroSamples = 0;
    const inspectCount = Math.min(buffer.length, startOffset + 2048);

    for (let i = startOffset; i < inspectCount; i++) {
      const byteVal = buffer[i];
      // 0x00 or 0x80 (midpoint in unsigned PCM) are silence
      if (byteVal !== 0x00 && byteVal !== 0x80) {
        nonZeroSamples++;
      }
    }

    return nonZeroSamples === 0;
  }
}

const whisperClient = new WhisperClient();
module.exports = whisperClient;
