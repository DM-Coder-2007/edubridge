/**
 * EduBridge Adaptive - faster-whisper Speech Recognition Test Suite
 *
 * Mandated Tests:
 * 1. Valid speech transcription
 * 2. Silence detection
 * 3. Unsupported audio format rejection
 * 4. Corrupted audio buffer rejection
 * 5. Missing model handling
 * 6. Transcription failure handling
 * 7. Temporary file cleanup (normal and error states)
 * 8. Optional Gemini answer evaluation integration
 * 9. Optional non-blocking behavior
 * 10. Rejection of Google Speech Recognition
 */

process.env.NODE_ENV = 'test';
process.env.WHISPER_MOCK_FALLBACK = 'true';
process.env.GEMINI_MOCK_FALLBACK = 'true';
process.env.CLOUDINARY_MOCK_FALLBACK = 'true';

const fs = require('fs');
const { whisperClient, transcriptionService } = require('../../src/integrations/speech');

// Helper to create valid WAV buffer
function createValidWavBuffer(textTag = 'voice-recording-sample') {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = 512;
  const fileSize = 44 + dataSize;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(fileSize - 8, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wavHeader.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const pcmData = Buffer.alloc(dataSize, 0x44);
  pcmData.write(textTag, 0);

  return Buffer.concat([wavHeader, pcmData]);
}

// Helper to create silent WAV buffer (all zero PCM)
function createSilentWavBuffer() {
  const sampleRate = 16000;
  const dataSize = 512;
  const fileSize = 44 + dataSize;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(fileSize - 8, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * 2, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const silencePcm = Buffer.alloc(dataSize, 0x00);
  return Buffer.concat([wavHeader, silencePcm]);
}

describe('Optional faster-whisper Speech Recognition Service', () => {
  afterEach(() => {
    whisperClient.clearMockOverrides();
  });

  // ==========================================================================
  // 1. Availability & Rejection of Google Speech Recognition
  // ==========================================================================
  describe('1. Availability & Rejection of Google Speech Recognition', () => {
    it('should report faster-whisper availability in mock/local mode', async () => {
      const health = await whisperClient.checkAvailability();
      expect(health.available).toBe(true);
      expect(health.engine).toBe('FASTER_WHISPER');
      expect(Array.isArray(health.supportedModels)).toBe(true);
      expect(health.supportedModels).toContain('base.en');
    });

    it('should reject Google Speech Recognition and enforce faster-whisper', async () => {
      const validAudio = createValidWavBuffer();
      await expect(
        transcriptionService.processVoiceAnswer(validAudio, { provider: 'google' })
      ).rejects.toThrow(/Google Speech Recognition is forbidden\. faster-whisper must be used/);
    });
  });

  // ==========================================================================
  // 2. Valid Speech Transcription
  // ==========================================================================
  describe('2. Valid Speech Transcription', () => {
    it('should transcribe valid speech audio with confidence and timestamps', async () => {
      const validAudio = createValidWavBuffer('student-voice-recording');
      const result = await transcriptionService.processVoiceAnswer(validAudio, {
        language: 'en',
        model: 'base.en'
      });

      expect(result.success).toBe(true);
      expect(typeof result.transcript).toBe('string');
      expect(result.transcript.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.language).toBe('en');
      expect(result.isSilent).toBe(false);
      expect(Array.isArray(result.timestamps)).toBe(true);
      expect(result.timestamps.length).toBeGreaterThan(0);
      expect(result.timestamps[0]).toHaveProperty('start');
      expect(result.timestamps[0]).toHaveProperty('end');
      expect(result.timestamps[0]).toHaveProperty('text');
    });
  });

  // ==========================================================================
  // 3. Silence Detection
  // ==========================================================================
  describe('3. Silence Detection', () => {
    it('should detect silent audio and return empty transcript with isSilent: true', async () => {
      const silentAudio = createSilentWavBuffer();
      const result = await transcriptionService.processVoiceAnswer(silentAudio, {
        language: 'en'
      });

      expect(result.success).toBe(true);
      expect(result.isSilent).toBe(true);
      expect(result.transcript).toBe('');
      expect(result.confidence).toBe(0.0);
    });

    it('should handle simulated silence override', async () => {
      whisperClient.setSimulatedSilence(true);
      const validAudio = createValidWavBuffer();
      const result = await transcriptionService.processVoiceAnswer(validAudio);

      expect(result.isSilent).toBe(true);
      expect(result.transcript).toBe('');
    });
  });

  // ==========================================================================
  // 4. Unsupported Audio Format Rejection
  // ==========================================================================
  describe('4. Unsupported Audio Format Handling', () => {
    it('should reject non-audio MIME types (e.g. image/jpeg, application/pdf)', async () => {
      const dummyBuffer = Buffer.alloc(100, 0x01);

      await expect(
        transcriptionService.processVoiceAnswer(dummyBuffer, { mimeType: 'image/jpeg' })
      ).rejects.toThrow(/Unsupported audio format "image\/jpeg"/);

      await expect(
        transcriptionService.processVoiceAnswer(dummyBuffer, { mimeType: 'application/pdf' })
      ).rejects.toThrow(/Unsupported audio format "application\/pdf"/);
    });

    it('should reject empty audio buffer (0 bytes)', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        transcriptionService.processVoiceAnswer(emptyBuffer)
      ).rejects.toThrow(/Audio buffer is empty/);
    });
  });

  // ==========================================================================
  // 5. Corrupted Audio Handling
  // ==========================================================================
  describe('5. Corrupted Audio Handling', () => {
    it('should reject corrupted audio lacking recognized headers', async () => {
      const corruptedBytes = Buffer.from('THIS_IS_CORRUPTED_TEXT_NOT_AN_AUDIO_FILE_DATA_CORRUPTION');

      await expect(
        transcriptionService.processVoiceAnswer(corruptedBytes, { mimeType: 'audio/wav' })
      ).rejects.toThrow(/Corrupted audio file\. Header does not match any recognized audio format/);
    });

    it('should reject truncated audio below minimum header threshold', async () => {
      const truncated = Buffer.from([0x52, 0x49, 0x46, 0x46]); // only 4 bytes

      await expect(
        transcriptionService.processVoiceAnswer(truncated)
      ).rejects.toThrow(/insufficient header size/);
    });
  });

  // ==========================================================================
  // 6. Missing Model Handling
  // ==========================================================================
  describe('6. Missing Model Handling', () => {
    it('should reject unsupported or invalid model names', async () => {
      const validAudio = createValidWavBuffer();

      await expect(
        transcriptionService.processVoiceAnswer(validAudio, {
          model: 'unsupported_non_existent_whisper_model_xyz'
        })
      ).rejects.toThrow(/Missing or invalid faster-whisper model/);
    });

    it('should handle simulated missing model weights', async () => {
      whisperClient.setSimulatedMissingModel(true);
      const validAudio = createValidWavBuffer();

      await expect(
        transcriptionService.processVoiceAnswer(validAudio, { model: 'base.en' })
      ).rejects.toThrow(/Model weights are not installed/);
    });
  });

  // ==========================================================================
  // 7. Transcription Failure Handling
  // ==========================================================================
  describe('7. Transcription Failure Handling', () => {
    it('should capture faster-whisper failure and throw descriptive error', async () => {
      whisperClient.setMockFailure('faster-whisper GPU memory allocation failed');
      const validAudio = createValidWavBuffer();

      await expect(
        transcriptionService.processVoiceAnswer(validAudio)
      ).rejects.toThrow(/faster-whisper transcription error: faster-whisper GPU memory allocation failed/);
    });
  });

  // ==========================================================================
  // 8. Temporary File Cleanup
  // ==========================================================================
  describe('8. Temporary File Cleanup Verification', () => {
    it('must guarantee local temporary audio file is removed from disk after transcription', async () => {
      let createdTempPath = null;

      const originalWrite = fs.promises.writeFile;
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data, opts) => {
        if (typeof filePath === 'string' && filePath.includes('edubridge_whisper_')) {
          createdTempPath = filePath;
        }
        return originalWrite.call(fs.promises, filePath, data, opts);
      });

      const validAudio = createValidWavBuffer();
      const result = await transcriptionService.processVoiceAnswer(validAudio);

      expect(result.success).toBe(true);
      expect(result.tempFileCleaned).toBe(true);
      expect(createdTempPath).not.toBeNull();

      // Verify file is completely removed from disk
      expect(fs.existsSync(createdTempPath)).toBe(false);

      fs.promises.writeFile.mockRestore();
    });

    it('must guarantee temporary file is removed from disk even if transcription fails', async () => {
      let createdTempPath = null;

      const originalWrite = fs.promises.writeFile;
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data, opts) => {
        if (typeof filePath === 'string' && filePath.includes('edubridge_whisper_')) {
          createdTempPath = filePath;
        }
        return originalWrite.call(fs.promises, filePath, data, opts);
      });

      whisperClient.setMockFailure('Crash during audio frame decoding');
      const validAudio = createValidWavBuffer();

      await expect(
        transcriptionService.processVoiceAnswer(validAudio)
      ).rejects.toThrow(/faster-whisper transcription error/);

      expect(createdTempPath).not.toBeNull();
      // Even on failure, temp file must not be orphaned!
      expect(fs.existsSync(createdTempPath)).toBe(false);

      fs.promises.writeFile.mockRestore();
    });
  });

  // ==========================================================================
  // 9. Optional Gemini Evaluation Integration
  // ==========================================================================
  describe('9. Optional Gemini Evaluation of Speech', () => {
    it('should transcribe voice answer and pass transcript to Gemini for evaluation', async () => {
      const validAudio = createValidWavBuffer();
      const result = await transcriptionService.processVoiceAnswer(validAudio, {
        evaluation: {
          questionText: 'What is the role of the cell wall?',
          correctAnswer: 'Providing structural support and protection',
          explanation: 'It acts as a rigid boundary maintaining shape.',
          conceptName: 'Plant Cell Wall'
        }
      });

      expect(result.success).toBe(true);
      expect(result.transcript).toBeDefined();
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation.isCorrect).toBe(true);
      expect(result.evaluation.score).toBeGreaterThanOrEqual(80);
      expect(result.evaluation.feedback).toBeDefined();
    });

    it('should return gentle encouragement if voice audio is completely silent', async () => {
      const silentAudio = createSilentWavBuffer();
      const result = await transcriptionService.processVoiceAnswer(silentAudio, {
        evaluation: {
          questionText: 'What is the role of the cell wall?',
          correctAnswer: 'Providing structural support'
        }
      });

      expect(result.isSilent).toBe(true);
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation.isCorrect).toBe(false);
      expect(result.evaluation.score).toBe(0);
      expect(result.evaluation.feedback).toContain('No voice answer was detected');
    });
  });
});
