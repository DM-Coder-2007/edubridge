/**
 * EduBridge Adaptive - Piper TTS Unit & Integration Test Suite
 *
 * Mandated Tests:
 * 1. Piper availability
 * 2. Generate short text
 * 3. Generate normal lesson text
 * 4. Handle Piper failure
 * 5. Handle missing voice/model
 * 6. Upload generated audio to Cloudinary
 * 7. Save metadata to Snowflake (audio_id, lesson_id, user_id, cloudinary_public_id, audio_url, duration, voice, format, created_at)
 * 8. Verify temporary files are cleaned
 * 9. Do not report TTS success unless actual audio generation succeeds
 * 10. Rejection of paid/cloud APIs
 */

process.env.NODE_ENV = 'test';
process.env.PIPER_MOCK_FALLBACK = 'true';
process.env.CLOUDINARY_MOCK_FALLBACK = 'true';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const fs = require('fs');
const { piperClient, piperService, audioService } = require('../../src/integrations/tts');
const databaseManager = require('../../src/database/snowflake/databaseManager');

describe('Local Piper TTS Service: EduBridge Adaptive', () => {
  beforeAll(async () => {
    await databaseManager.initializeDatabase();
  });

  afterEach(() => {
    piperClient.clearMockOverrides();
  });

  // ==========================================================================
  // 1. Piper Availability
  // ==========================================================================
  describe('1. Piper Availability & Runtime Verification', () => {
    it('should report Piper availability with supported voice models', async () => {
      const status = await piperClient.checkAvailability();
      expect(status).toBeDefined();
      expect(status.available).toBe(true);
      expect(status.engine).toBe('PIPER_TTS');
      expect(Array.isArray(status.supportedVoices)).toBe(true);
      expect(status.supportedVoices).toContain('en_US-lessac-medium');
    });

    it('should reject paid/cloud APIs and enforce local Piper TTS', async () => {
      await expect(
        piperClient.synthesizeRaw('Hello world', { provider: 'google' })
      ).rejects.toThrow(/Google Cloud TTS and paid TTS APIs are forbidden/);
    });
  });

  // ==========================================================================
  // 2. Generate Short Text
  // ==========================================================================
  describe('2. Short Text Synthesis', () => {
    it('should synthesize audio for short phrase with valid duration and audio buffer', async () => {
      const shortText = 'Welcome to EduBridge.';
      const result = await piperClient.synthesizeRaw(shortText, {
        voice: 'en_US-lessac-medium',
        speakingRate: 1.0
      });

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      expect(result.audioBuffer.length).toBeGreaterThan(44); // At least WAV header + PCM
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(result.format).toBe('wav');
      expect(result.voice).toBe('en_US-lessac-medium');
    });
  });

  // ==========================================================================
  // 3. Generate Normal Lesson Text
  // ==========================================================================
  describe('3. Normal Lesson Text Synthesis', () => {
    it('should synthesize audio for full lesson narration with speed adjustment', async () => {
      const lessonText = `Welcome to biology. Today we explore plant cell structure.
      Imagine holding a soft water balloon inside a rigid wooden shoebox.
      The balloon is the central vacuole, and the wooden box is the rigid cell wall.
      The wall provides structural support so plants can stand tall toward the sunlight.`;

      const normalSpeed = await piperClient.synthesizeRaw(lessonText, {
        voice: 'en_US-amy-medium',
        speakingRate: 1.0
      });

      const fastSpeed = await piperClient.synthesizeRaw(lessonText, {
        voice: 'en_US-amy-medium',
        speakingRate: 1.5
      });

      expect(normalSpeed.audioBuffer.length).toBeGreaterThan(100);
      expect(fastSpeed.audioBuffer.length).toBeGreaterThan(100);
      // Fast speed should have shorter duration
      expect(fastSpeed.durationSeconds).toBeLessThan(normalSpeed.durationSeconds);
      expect(normalSpeed.voice).toBe('en_US-amy-medium');
    });
  });

  // ==========================================================================
  // 4. Handle Piper Failure
  // ==========================================================================
  describe('4. Piper Process Failure Handling', () => {
    it('should catch Piper failure and reject without reporting success', async () => {
      // Simulate Piper process crash
      piperClient.setMockFailure('Piper binary crashed with segmentation fault');

      await expect(
        piperClient.synthesizeRaw('Testing error handling')
      ).rejects.toThrow(/Piper synthesis failed: Piper binary crashed/);

      // Verify that audioService also catches failure and does NOT report success
      await expect(
        audioService.generateSpeechAndUpload({
          text: 'Lesson narration that should fail',
          lessonId: 'les_fail_test'
        })
      ).rejects.toThrow(/Piper synthesis failed/);
    });

    it('should reject empty or whitespace text before synthesis', async () => {
      await expect(
        piperService.synthesizeToTempFile('   ')
      ).rejects.toThrow(/Prepared text is empty/);
    });
  });

  // ==========================================================================
  // 5. Handle Missing Voice / Model
  // ==========================================================================
  describe('5. Missing Voice / Model Handling', () => {
    it('should throw descriptive error when requested voice model is missing or unsupported', async () => {
      await expect(
        piperClient.synthesizeRaw('Testing missing voice', {
          voice: 'non_existent_unsupported_voice_xyz'
        })
      ).rejects.toThrow(/Missing Piper voice\/model: "non_existent_unsupported_voice_xyz"/);
    });

    it('should handle simulated missing voice file', async () => {
      piperClient.setSimulatedMissingVoice(true);

      await expect(
        piperClient.synthesizeRaw('Testing missing model onnx file', {
          voice: 'en_US-lessac-medium'
        })
      ).rejects.toThrow(/Voice model file \(\.onnx\) is not installed/);
    });
  });

  // ==========================================================================
  // 6. Upload Generated Audio to Cloudinary
  // ==========================================================================
  describe('6. Cloudinary Upload Integration', () => {
    it('should upload generated speech audio to Cloudinary and return secure URL', async () => {
      const result = await audioService.generateSpeechAndUpload({
        text: 'Uploading speech to Cloudinary.',
        entityType: 'LESSON',
        entityId: 'les_cloud_test_1',
        lessonId: 'les_cloud_test_1',
        userId: 'usr_cloud_test'
      });

      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
      expect(result.audioUrl).toContain('cloudinary.com');
      expect(result.cloudinaryPublicId).toBeDefined();
      expect(result.cloudinaryPublicId).toContain('audio_lesson_les_cloud_test_1');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 7. Save Metadata to Snowflake
  // ==========================================================================
  describe('7. Snowflake Metadata Persistence', () => {
    it('should save audio metadata with all mandated fields to Snowflake table AUDIO_ASSETS', async () => {
      const lessonId = `les_meta_${Date.now()}`;
      const userId = `usr_meta_${Date.now()}`;
      const text = 'Testing Snowflake persistence for synthesized speech.';

      const result = await audioService.generateSpeechAndUpload({
        text,
        entityType: 'LESSON',
        entityId: lessonId,
        lessonId,
        userId,
        voice: 'en_US-lessac-medium',
        speakingRate: 1.0,
        format: 'wav'
      });

      expect(result.success).toBe(true);
      expect(result.audioId).toBeDefined();

      // Query Snowflake AUDIO_ASSETS table to verify exact schema fields
      const rows = await databaseManager.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS WHERE ID = ?',
        [result.audioId]
      );

      expect(rows.length).toBe(1);
      const row = rows[0];

      // Required fields mandate:
      // audio_id, lesson_id, user_id, cloudinary_public_id, audio_url, duration, voice, format, created_at
      expect(row.ID).toBe(result.audioId);
      expect(row.AUDIO_URL).toBe(result.audioUrl);
      expect(row.AUDIO_PUBLIC_ID).toBe(result.cloudinaryPublicId);
      expect(parseFloat(row.DURATION_SECONDS)).toBe(result.duration);
      expect(row.VOICE_ID).toBe('en_US-lessac-medium');
      expect(row.AUDIO_FORMAT).toBe('wav');
      expect(row.CREATED_AT).toBeDefined();

      // Verify metadata payload
      const meta = typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA;
      expect(meta.audio_id).toBe(result.audioId);
      expect(meta.lesson_id).toBe(lessonId);
      expect(meta.user_id).toBe(userId);
      expect(meta.cloudinary_public_id).toBe(result.cloudinaryPublicId);
      expect(meta.audio_url).toBe(result.audioUrl);
      expect(meta.duration).toBe(result.duration);
      expect(meta.voice).toBe('en_US-lessac-medium');
      expect(meta.format).toBe('wav');
      expect(meta.created_at).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. Temporary File Cleanup Verification
  // ==========================================================================
  describe('8. Temporary File Cleanup Verification', () => {
    it('must guarantee local temporary audio file is removed from disk after Cloudinary upload', async () => {
      let createdTempPath = null;

      // Track temp file path during synthesis
      const originalWrite = fs.promises.writeFile;
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data, opts) => {
        if (typeof filePath === 'string' && filePath.includes('edubridge_tts_')) {
          createdTempPath = filePath;
        }
        return originalWrite.call(fs.promises, filePath, data, opts);
      });

      const result = await audioService.generateSpeechAndUpload({
        text: 'Checking that temporary files are deleted after upload.',
        lessonId: 'les_clean_test'
      });

      expect(result.success).toBe(true);
      expect(createdTempPath).not.toBeNull();

      // Verify that temporary file DOES NOT exist on disk after completion!
      const fileStillExists = fs.existsSync(createdTempPath);
      expect(fileStillExists).toBe(false);

      fs.promises.writeFile.mockRestore();
    });

    it('should clean up temporary file even if Cloudinary upload throws an error', async () => {
      let createdTempPath = null;

      const originalWrite = fs.promises.writeFile;
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data, opts) => {
        if (typeof filePath === 'string' && filePath.includes('edubridge_tts_')) {
          createdTempPath = filePath;
        }
        return originalWrite.call(fs.promises, filePath, data, opts);
      });

      // Force upload failure
      const mediaService = require('../../src/services/media/media.service');
      jest.spyOn(mediaService, 'uploadAudio').mockRejectedValueOnce(new Error('Simulated Cloudinary upload network failure'));

      await expect(
        audioService.generateSpeechAndUpload({
          text: 'Upload failure cleanup test',
          lessonId: 'les_upload_fail'
        })
      ).rejects.toThrow(/Cloudinary audio upload failed: Simulated Cloudinary upload network failure/);

      expect(createdTempPath).not.toBeNull();
      // Even on failure, temp file must be cleaned!
      expect(fs.existsSync(createdTempPath)).toBe(false);

      fs.promises.writeFile.mockRestore();
      mediaService.uploadAudio.mockRestore();
    });
  });

  // ==========================================================================
  // 9. Lesson Summary & Adaptive Explanation Specialized Audio
  // ==========================================================================
  describe('9. Specialized Speech Operations', () => {
    it('should generate lesson summary audio and associate with lessonId', async () => {
      const summaryResult = await audioService.generateLessonSummaryAudio({
        lessonId: 'les_summary_special',
        userId: 'usr_student_1',
        text: 'Summary: Plant cells have a rigid wall of cellulose supporting their shape.',
        voice: 'en_US-ryan-medium'
      });

      expect(summaryResult.success).toBe(true);
      expect(summaryResult.audioUrl).toBeDefined();
      expect(summaryResult.lessonId).toBe('les_summary_special');
      expect(summaryResult.voice).toBe('en_US-ryan-medium');
    });

    it('should generate adaptive explanation audio with sensory analogies', async () => {
      const explanationResult = await audioService.generateAdaptiveExplanationAudio({
        lessonId: 'les_adaptive_special',
        userId: 'usr_student_1',
        conceptId: 'cpt_cell_wall',
        text: 'Picture holding a soft water balloon inside a wooden box. That is how the cell wall protects the plant cell.',
        voice: 'en_US-amy-medium'
      });

      expect(explanationResult.success).toBe(true);
      expect(explanationResult.audioUrl).toBeDefined();
      expect(explanationResult.voice).toBe('en_US-amy-medium');
    });
  });
});
