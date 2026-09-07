/**
 * EduBridge Adaptive - Piper TTS Client
 *
 * Local neural text-to-speech client manager.
 * 
 * CRITICAL ARCHITECTURE RULES:
 * - Operates STRICTLY as a local backend service / process.
 * - DO NOT use Google Cloud Text-to-Speech or any paid TTS APIs.
 * - Piper is the designated local neural voice engine.
 * - Validates voice models, configurable speeds, and local process availability.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

// Known / supported standard Piper neural voice models
const SUPPORTED_PIPER_VOICES = [
  'en_US-lessac-medium',
  'en_US-lessac-high',
  'en_US-lessac-low',
  'en_US-amy-medium',
  'en_US-amy-low',
  'en_US-ryan-medium',
  'en_US-ryan-high',
  'en_US-danny-low',
  'en_GB-alan-medium',
  'en_GB-southern_english_female-low'
];

class PiperClient {
  constructor() {
    this.binPath = process.env.PIPER_BIN_PATH || 'piper';
    this.modelPath = process.env.PIPER_MODEL_PATH || '';
    this.defaultVoice = process.env.PIPER_VOICE || 'en_US-lessac-medium';
    this.httpUrl = process.env.PIPER_HTTP_URL || '';
    this.defaultRate = parseFloat(process.env.PIPER_SPEAKING_RATE || '1.0');

    // Determine mock / emulation mode
    const forceMock = process.env.PIPER_MOCK_FALLBACK === 'true';
    const hasLiveEngine = Boolean(this.httpUrl || (this.modelPath && fs.existsSync(this.modelPath)));
    this._isMock = forceMock || !hasLiveEngine;

    // Test overrides
    this._mockFailure = null;
    this._simulatedMissingVoice = false;

    if (this._isMock) {
      logger.info('[PiperClient] Running in LOCAL MOCK/SIMULATION mode. Piper TTS is the designated voice engine.');
    } else {
      logger.info(`[PiperClient] Live Piper TTS configured. Default Voice: "${this.defaultVoice}", Bin: "${this.binPath}"`);
    }
  }

  isMockMode() {
    return this._isMock;
  }

  setMockMode(mock) {
    this._isMock = Boolean(mock);
  }

  setMockFailure(errorOrBool) {
    this._mockFailure = errorOrBool;
  }

  setSimulatedMissingVoice(bool) {
    this._simulatedMissingVoice = Boolean(bool);
  }

  clearMockOverrides() {
    this._mockFailure = null;
    this._simulatedMissingVoice = false;
  }

  /**
   * Check Piper availability and runtime configuration
   * @returns {Promise<{ available: boolean, engine: string, mode: string, defaultVoice: string, supportedVoices: string[], details?: object }>}
   */
  async checkAvailability() {
    if (this._mockFailure) {
      return {
        available: false,
        engine: 'PIPER_TTS',
        mode: 'MOCK_SIMULATION',
        error: typeof this._mockFailure === 'string' ? this._mockFailure : 'Piper service unavailable'
      };
    }

    if (this._isMock) {
      return {
        available: true,
        engine: 'PIPER_TTS',
        mode: 'MOCK_SIMULATION',
        defaultVoice: this.defaultVoice,
        supportedVoices: [...SUPPORTED_PIPER_VOICES]
      };
    }

    // Check live HTTP sidecar
    if (this.httpUrl) {
      try {
        const res = await fetch(`${this.httpUrl}/api/voices`);
        if (res.ok) {
          return {
            available: true,
            engine: 'PIPER_TTS',
            mode: 'HTTP_SIDECAR',
            httpUrl: this.httpUrl,
            defaultVoice: this.defaultVoice,
            supportedVoices: [...SUPPORTED_PIPER_VOICES]
          };
        }
      } catch (err) {
        return {
          available: false,
          engine: 'PIPER_TTS',
          mode: 'HTTP_SIDECAR',
          error: `Sidecar connection failed: ${err.message}`
        };
      }
    }

    // Check local CLI binary
    try {
      const cliWorks = await new Promise((resolve) => {
        const child = spawn(this.binPath, ['--help']);
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0 || code === 1));
      });

      return {
        available: cliWorks,
        engine: 'PIPER_TTS',
        mode: 'LOCAL_CLI',
        binPath: this.binPath,
        modelPath: this.modelPath,
        defaultVoice: this.defaultVoice,
        supportedVoices: [...SUPPORTED_PIPER_VOICES]
      };
    } catch {
      return {
        available: false,
        engine: 'PIPER_TTS',
        mode: 'LOCAL_CLI',
        error: 'Piper CLI binary not found in system path'
      };
    }
  }

  /**
   * Validate that a voice name is supported and installed
   * @param {string} voiceName
   * @throws {Error} if voice model is missing or unsupported
   */
  validateVoice(voiceName) {
    if (this._simulatedMissingVoice) {
      throw new Error(`Missing Piper voice/model: "${voiceName}". Voice model file (.onnx) is not installed.`);
    }

    if (!voiceName) return this.defaultVoice;

    const normalized = voiceName.trim();
    const isKnown = SUPPORTED_PIPER_VOICES.some(v => v.toLowerCase() === normalized.toLowerCase());

    // In live mode with explicit modelPath, check if file exists
    if (!this._isMock && this.modelPath && !fs.existsSync(this.modelPath)) {
      throw new Error(`Missing Piper voice/model: "${normalized}". Model path does not exist: ${this.modelPath}`);
    }

    if (!isKnown && !normalized.includes('.')) {
      throw new Error(
        `Missing Piper voice/model: "${normalized}". Supported voices: ${SUPPORTED_PIPER_VOICES.join(', ')}`
      );
    }

    return normalized;
  }

  /**
   * Canonical synthesize method for Piper TTS
   * @param {string} text
   * @param {object} [options={}]
   * @returns {Promise<{ audioBuffer: Buffer, durationSeconds: number, format: 'wav'|'mp3', sampleRate: number }>}
   */
  async synthesize(text, options = {}) {
    return this.synthesizeRaw(text, options);
  }

  /**
   * Synthesize raw audio from text using Piper
   *
   * @param {string} text - Clean speech text
   * @param {object} [options={}] - Options { voice, speakingRate }
   * @returns {Promise<{ audioBuffer: Buffer, durationSeconds: number, format: 'wav'|'mp3', sampleRate: number }>}
   */
  async synthesizeRaw(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('TTS synthesis failed: Text input must be a non-empty string.');
    }

    // Explicit rejection of paid/cloud APIs
    if (options.provider === 'google' || options.provider === 'gcp' || options.provider === 'paid') {
      throw new Error('Prohibited: Google Cloud TTS and paid TTS APIs are forbidden. Piper TTS must be used.');
    }

    const activeVoice = this.validateVoice(options.voice || this.defaultVoice);
    const activeRate = Math.max(0.5, Math.min(2.0, parseFloat(options.speakingRate || this.defaultRate || 1.0)));

    // Test failure injection
    if (this._mockFailure) {
      const errMessage = typeof this._mockFailure === 'string'
        ? this._mockFailure
        : (this._mockFailure.message || 'Piper process crashed unexpectedly');
      logger.error(`[PiperClient] Simulated Piper failure: ${errMessage}`);
      throw new Error(`Piper synthesis failed: ${errMessage}`);
    }

    const wordCount = text.trim().split(/\s+/).length;
    // Standard reading speed: ~150 words per minute
    const durationSeconds = Math.max(1.0, Number(((wordCount / 150) * 60 / activeRate).toFixed(2)));

    // ------------------------------------------------------------------------
    // 1. Mock Mode (CI / Local testing without ONNX runtime weights)
    // ------------------------------------------------------------------------
    if (this._isMock || (!this.modelPath && !this.httpUrl)) {
      // Build standard, valid 44-byte RIFF/WAV audio header + PCM audio frame
      const sampleRate = 22050;
      const numChannels = 1;
      const bitsPerSample = 16;
      const numSamples = Math.round(sampleRate * durationSeconds);
      const dataSize = numSamples * numChannels * (bitsPerSample / 8);
      const fileSize = 44 + dataSize;

      const wavHeader = Buffer.alloc(44);
      // RIFF header
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(fileSize - 8, 4);
      wavHeader.write('WAVE', 8);
      // "fmt " chunk
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16); // subchunk1 size
      wavHeader.writeUInt16LE(1, 20); // PCM format
      wavHeader.writeUInt16LE(numChannels, 22);
      wavHeader.writeUInt32LE(sampleRate, 24);
      wavHeader.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
      wavHeader.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
      wavHeader.writeUInt16LE(bitsPerSample, 34);
      // "data" chunk
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(dataSize, 40);

      // Generate quiet tone/noise PCM data
      const pcmData = Buffer.alloc(dataSize, 0x55);
      const audioBuffer = Buffer.concat([wavHeader, pcmData]);

      logger.info(
        `[PiperClient] [MOCK] Synthesized speech: ${wordCount} words, ${durationSeconds}s, voice="${activeVoice}", speed=${activeRate}x`
      );

      return {
        audioBuffer,
        durationSeconds,
        format: 'wav',
        sampleRate,
        voice: activeVoice,
        speakingRate: activeRate
      };
    }

    // ------------------------------------------------------------------------
    // 2. Live Piper HTTP Sidecar
    // ------------------------------------------------------------------------
    if (this.httpUrl) {
      try {
        const lengthScale = (1.0 / activeRate).toFixed(2);
        const response = await fetch(`${this.httpUrl}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: activeVoice,
            length_scale: parseFloat(lengthScale)
          })
        });

        if (!response.ok) {
          throw new Error(`Piper sidecar returned HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuf = await response.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuf);

        if (!audioBuffer || audioBuffer.length === 0) {
          throw new Error('Piper sidecar returned empty audio buffer');
        }

        return {
          audioBuffer,
          durationSeconds,
          format: 'wav',
          sampleRate: 22050,
          voice: activeVoice,
          speakingRate: activeRate
        };
      } catch (err) {
        logger.error('[PiperClient] HTTP sidecar synthesis failed:', err.message);
        throw new Error(`Piper HTTP synthesis failed: ${err.message}`);
      }
    }

    // ------------------------------------------------------------------------
    // 3. Live Piper Local CLI Process Execution
    // ------------------------------------------------------------------------
    return new Promise((resolve, reject) => {
      const lengthScale = (1.0 / activeRate).toFixed(2);
      const args = [
        '--model', this.modelPath,
        '--output_raw',
        '--length_scale', lengthScale
      ];

      logger.info(`[PiperClient] Spawning local Piper CLI: ${this.binPath} ${args.join(' ')}`);

      const child = spawn(this.binPath, args);
      const stdoutChunks = [];
      const stderrChunks = [];

      child.stdout.on('data', chunk => stdoutChunks.push(chunk));
      child.stderr.on('data', chunk => stderrChunks.push(chunk));

      child.on('error', (spawnErr) => {
        logger.error('[PiperClient] Process spawn error:', spawnErr.message);
        reject(new Error(`Piper executable could not be launched: ${spawnErr.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          const rawBuffer = Buffer.concat(stdoutChunks);
          if (rawBuffer.length === 0) {
            reject(new Error('Piper CLI completed with code 0 but generated 0 bytes of audio.'));
            return;
          }

          resolve({
            audioBuffer: rawBuffer,
            durationSeconds,
            format: 'wav',
            sampleRate: 22050,
            voice: activeVoice,
            speakingRate: activeRate
          });
        } else {
          const stderrText = Buffer.concat(stderrChunks).toString();
          logger.error(`[PiperClient] Process exited with code ${code}:`, stderrText);
          reject(new Error(`Piper process exited with error code ${code}: ${stderrText || 'Unknown error'}`));
        }
      });

      // Pipe text to Piper stdin
      child.stdin.write(text);
      child.stdin.end();
    });
  }
}

const piperClient = new PiperClient();
module.exports = piperClient;
