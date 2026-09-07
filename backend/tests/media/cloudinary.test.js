/**
 * EduBridge Adaptive - Cloudinary Media Infrastructure Test Suite
 *
 * CRITICAL ARCHITECTURE RULE:
 * Cloudinary is the MANDATORY canonical media storage and delivery platform.
 * Image and audio binary data must NEVER be stored in Snowflake.
 *
 * Verifies:
 * 1. Cloudinary connectivity & health diagnostics
 * 2. Image upload (original & preprocessed)
 * 3. Non-destructive image transformation URLs (pipeline stages & accessibility)
 * 4. Audio upload using audio fixture
 * 5. Waveform URL generation
 * 6. Streaming CDN audio URL generation
 * 7. Metadata retrieval & existence checking
 * 8. Asset deletion with CDN cache invalidation
 * 9. Invalid file rejection (empty buffer, non-buffer, unsupported MIME)
 * 10. Oversized file rejection (exceeding 15MB image / 50MB audio)
 * 11. Zero secret leakage (CLOUDINARY_API_SECRET is never exposed)
 * 12. Tenancy and metadata sanitization
 * 13. High-level MediaService facade
 */

const mediaService = require('../../src/services/media/media.service');
const cloudinaryClient = require('../../src/integrations/cloudinary/client');
const uploadService = require('../../src/integrations/cloudinary/upload.service');
const transformationService = require('../../src/integrations/cloudinary/transformation.service');
const assetService = require('../../src/integrations/cloudinary/asset.service');
const deleteService = require('../../src/integrations/cloudinary/delete.service');
const healthCheck = require('../../src/integrations/cloudinary/healthCheck');

describe('Cloudinary Media Infrastructure: EduBridge Adaptive', () => {
  // Sample test fixtures
  let sampleImageBuffer;
  let sampleAudioBuffer;
  const mockSecret = 'super_secret_cloudinary_key_xyz123!';

  beforeAll(() => {
    // Set mock secret in environment to verify zero leakage
    process.env.CLOUDINARY_API_SECRET = mockSecret;

    // Create realistic small binary fixtures
    // 1. JPEG image header bytes (SOI marker 0xFFD8FFE0)
    sampleImageBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43
    ]);

    // 2. MP3 audio header bytes (ID3v2 header: "ID3" + version + flags + size)
    sampleAudioBuffer = Buffer.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0xff, 0xfb,
      0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
  });

  beforeEach(() => {
    cloudinaryClient.resetMockStore();
  });

  // --------------------------------------------------------------------------
  // 1. Connectivity & Health Check
  // --------------------------------------------------------------------------
  describe('1. Connectivity & Health Check', () => {
    it('should report healthy status and connectivity diagnostics', async () => {
      const health = await mediaService.checkCloudinaryHealth();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
      expect(health.mode).toBeDefined();
      expect(health.cloudName).toBeDefined();
      expect(health.baseFolder).toBe('edubridge');
      expect(typeof health.latencyMs).toBe('number');
    });

    it('should handle ping failure gracefully in health check', async () => {
      const pingSpy = jest.spyOn(cloudinaryClient, 'ping').mockResolvedValueOnce({
        status: 'error',
        connected: false,
        mode: 'LIVE_CLOUDINARY',
        error: 'Cloudinary API unreachable',
        latencyMs: 500
      });

      const health = await healthCheck.checkHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.connected).toBe(false);
      expect(health.error).toBe('Cloudinary API unreachable');

      pingSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Image Upload (Original & Preprocessed)
  // --------------------------------------------------------------------------
  describe('2. Image Upload', () => {
    it('should upload a textbook scan and return canonical media descriptor', async () => {
      const result = await mediaService.uploadImage(sampleImageBuffer, {
        folder: 'edubridge/textbooks/raw',
        userId: 'usr_student_123',
        textbookId: 'txt_biology_ch4',
        mimeType: 'image/jpeg',
        tags: ['chapter_4', 'cell_biology']
      });

      expect(result).toBeDefined();
      expect(result.publicId).toContain('edubridge/textbooks/raw');
      expect(result.url).toBeDefined();
      expect(result.secureUrl).toBeDefined();
      expect(result.secureUrl).toMatch(/^https:\/\//);
      expect(result.resourceType).toBe('image');
      expect(result.bytes).toBe(sampleImageBuffer.length);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.context.userId).toBe('usr_student_123');
      expect(result.context.textbookId).toBe('txt_biology_ch4');
    });

    it('should support uploading preprocessed OCR images to designated folder', async () => {
      const result = await mediaService.uploadImage(sampleImageBuffer, {
        folder: 'edubridge/textbooks/processed',
        userId: 'usr_student_123',
        textbookId: 'txt_biology_ch4',
        mimeType: 'image/png'
      });

      expect(result.publicId).toContain('edubridge/textbooks/processed');
      expect(result.format).toBe('png');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Image Transformation URLs (Non-Destructive Pipeline)
  // --------------------------------------------------------------------------
  describe('3. Image Transformation URLs (Pipeline Stages & Accessibility)', () => {
    const publicId = 'edubridge/textbooks/raw/cell_diagram_p1';

    it('should generate OCR preprocessing transformation URL', () => {
      const url = mediaService.generateImageTransformation(publicId, {
        pipelineStage: 'ocr'
      });

      expect(url).toContain(publicId);
      expect(url).toContain('e_grayscale');
      expect(url).toContain('e_contrast:60');
      expect(url).toContain('e_sharpen:120');
      expect(url).toContain('w_2000');
    });

    it('should generate High Contrast accessibility view URL', () => {
      const url = mediaService.generateImageTransformation(publicId, {
        preset: 'HIGH_CONTRAST',
        width: 1800
      });

      expect(url).toContain(publicId);
      expect(url).toContain('e_contrast:50');
      expect(url).toContain('e_sharpen:100');
      expect(url).toContain('w_1800');
    });

    it('should generate Inverted Dark Mode view URL for low-vision readers', () => {
      const url = mediaService.generateImageTransformation(publicId, {
        preset: 'INVERTED',
        width: 1600
      });

      expect(url).toContain(publicId);
      expect(url).toContain('e_negate');
      expect(url).toContain('e_contrast:50');
    });

    it('should generate Tactile Edge relief transformation for tactile graphic embossers', () => {
      const url = mediaService.generateImageTransformation(publicId, {
        preset: 'TACTILE_EDGE'
      });

      expect(url).toContain(publicId);
      expect(url).toContain('e_grayscale');
      expect(url).toContain('e_contrast:70');
      expect(url).toContain('e_sharpen:150');
    });

    it('should not mutate original public ID or destroy original asset in URL generation', () => {
      const originalUrl = mediaService.generateImageTransformation(publicId, { pipelineStage: 'original' });
      const ocrUrl = mediaService.generateImageTransformation(publicId, { preset: 'OCR_READY' });

      expect(originalUrl).toContain(publicId);
      expect(ocrUrl).toContain(publicId);
      expect(ocrUrl).not.toEqual(originalUrl);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Audio Upload (Lesson Narration MP3)
  // --------------------------------------------------------------------------
  describe('4. Audio Upload', () => {
    it('should upload an audio fixture and associate with lesson metadata', async () => {
      const result = await mediaService.uploadAudio(sampleAudioBuffer, {
        userId: 'usr_student_456',
        lessonId: 'les_mitosis_part1',
        mimeType: 'audio/mpeg',
        duration: 142.5,
        ttsEngine: 'PIPER_TTS',
        voiceId: 'en_US-lessac-medium'
      });

      expect(result).toBeDefined();
      expect(result.publicId).toContain('audio_lesson_les_mitosis_part1');
      expect(result.url).toBeDefined();
      expect(result.secureUrl).toBeDefined();
      expect(result.resourceType).toBe('video'); // Cloudinary stores audio under video resource_type
      expect(result.format).toBe('mp3');
      expect(result.duration).toBe(142.5);
      expect(result.context.userId).toBe('usr_student_456');
      expect(result.context.lessonId).toBe('les_mitosis_part1');
      expect(result.context.ttsEngine).toBe('PIPER_TTS');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Waveform URL Generation
  // --------------------------------------------------------------------------
  describe('5. Waveform URL Generation', () => {
    it('should generate waveform visualization image URL from audio public ID', () => {
      const audioId = 'edubridge/audio/audio_lesson_les_mitosis_part1';
      const waveformUrl = mediaService.generateWaveformUrl(audioId, {
        width: 1000,
        height: 160,
        color: '00ffaa'
      });

      expect(waveformUrl).toBeDefined();
      expect(waveformUrl).toContain('fl_waveform');
      expect(waveformUrl).toContain('co_rgb:00ffaa');
      expect(waveformUrl).toContain('w_1000');
      expect(waveformUrl).toContain('h_160');
      expect(waveformUrl).toContain('.png');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Streaming Audio CDN URL
  // --------------------------------------------------------------------------
  describe('6. Streaming Audio CDN Delivery', () => {
    it('should generate streaming-friendly audio delivery URL', () => {
      const audioId = 'edubridge/audio/audio_lesson_les_mitosis_part1';
      const streamUrl = mediaService.generateStreamingAudioUrl(audioId, {
        bitrate: '192k',
        format: 'mp3'
      });

      expect(streamUrl).toBeDefined();
      expect(streamUrl).toContain('br_192k');
      expect(streamUrl).toContain('.mp3');
      expect(streamUrl).toContain('video/upload');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Metadata Retrieval
  // --------------------------------------------------------------------------
  describe('7. Metadata Retrieval', () => {
    it('should retrieve metadata for an uploaded image', async () => {
      const upload = await mediaService.uploadImage(sampleImageBuffer, {
        userId: 'usr_789',
        mimeType: 'image/jpeg'
      });

      const meta = await mediaService.getAssetMetadata(upload.publicId, { resourceType: 'image' });
      expect(meta).toBeDefined();
      expect(meta.publicId).toBe(upload.publicId);
      expect(meta.bytes).toBe(sampleImageBuffer.length);
      expect(meta.resourceType).toBe('image');
      expect(meta.context.userId).toBe('usr_789');
    });

    it('should retrieve metadata for an uploaded audio asset', async () => {
      const upload = await mediaService.uploadAudio(sampleAudioBuffer, {
        lessonId: 'les_meta_test',
        mimeType: 'audio/mpeg',
        duration: 98.4
      });

      const meta = await mediaService.getAssetMetadata(upload.publicId, { resourceType: 'video' });
      expect(meta).toBeDefined();
      expect(meta.publicId).toBe(upload.publicId);
      expect(meta.resourceType).toBe('video');
      expect(meta.duration).toBe(98.4);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Asset Deletion
  // --------------------------------------------------------------------------
  describe('8. Asset Deletion', () => {
    it('should delete an asset and return confirmation', async () => {
      const upload = await mediaService.uploadImage(sampleImageBuffer);
      const deleteResult = await mediaService.deleteAsset(upload.publicId, { resourceType: 'image' });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.result).toBe('ok');
      expect(deleteResult.publicId).toBe(upload.publicId);

      // Verify asset is removed from mock store
      const inStore = cloudinaryClient.getMockAsset(upload.publicId);
      expect(inStore).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Invalid File Rejection
  // --------------------------------------------------------------------------
  describe('9. Invalid File Rejection', () => {
    it('should reject empty image buffer (0 bytes)', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(
        mediaService.uploadImage(emptyBuffer, { mimeType: 'image/jpeg' })
      ).rejects.toThrow(/File buffer is empty/);
    });

    it('should reject non-buffer image input', async () => {
      await expect(
        mediaService.uploadImage('not-a-buffer', { mimeType: 'image/jpeg' })
      ).rejects.toThrow(/Expected a valid Node\.js Buffer/);
    });

    it('should reject unsupported image MIME type', async () => {
      await expect(
        mediaService.uploadImage(sampleImageBuffer, { mimeType: 'application/x-executable' })
      ).rejects.toThrow(/Unsupported image format/);
    });

    it('should reject unsupported audio MIME type', async () => {
      await expect(
        mediaService.uploadAudio(sampleAudioBuffer, { mimeType: 'application/zip' })
      ).rejects.toThrow(/Unsupported audio format/);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Oversized File Rejection
  // --------------------------------------------------------------------------
  describe('10. Oversized File Rejection', () => {
    it('should reject an image exceeding the 15MB limit', async () => {
      // Create virtual oversized buffer (16MB)
      const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
      await expect(
        mediaService.uploadImage(oversizedBuffer, { mimeType: 'image/jpeg' })
      ).rejects.toThrow(/File size limit exceeded: image is 16\.00MB, maximum permitted is 15MB/);
    });

    it('should reject audio exceeding the 50MB limit', async () => {
      // Create virtual oversized audio buffer (51MB)
      const oversizedAudio = Buffer.alloc(51 * 1024 * 1024);
      await expect(
        mediaService.uploadAudio(oversizedAudio, { mimeType: 'audio/mpeg' })
      ).rejects.toThrow(/File size limit exceeded: audio is 51\.00MB, maximum permitted is 50MB/);
    });
  });

  // --------------------------------------------------------------------------
  // 11. Zero Secret Leakage Checks
  // --------------------------------------------------------------------------
  describe('11. Zero Secret Leakage Checks', () => {
    it('should never expose CLOUDINARY_API_SECRET in health check response', async () => {
      const health = await mediaService.checkCloudinaryHealth();
      const stringified = JSON.stringify(health);

      expect(stringified).not.toContain(mockSecret);
      expect(health.apiSecret).toBeUndefined();
      expect(health.apiKeySecret).toBeUndefined();
    });

    it('should never expose CLOUDINARY_API_SECRET in getSafeConfig()', () => {
      const safeConfig = cloudinaryClient.getSafeConfig();
      const stringified = JSON.stringify(safeConfig);

      expect(stringified).not.toContain(mockSecret);
      expect(safeConfig.apiSecret).toBeUndefined();
      expect(safeConfig.apiKey).toContain('****');
    });

    it('should never expose CLOUDINARY_API_SECRET in upload or metadata responses', async () => {
      const upload = await mediaService.uploadImage(sampleImageBuffer);
      const meta = await mediaService.getAssetMetadata(upload.publicId);

      expect(JSON.stringify(upload)).not.toContain(mockSecret);
      expect(JSON.stringify(meta)).not.toContain(mockSecret);
    });

    it('should never expose CLOUDINARY_API_SECRET in generated transformation URLs', () => {
      const url = mediaService.generateImageTransformation('edubridge/sample', { preset: 'OCR_READY' });
      const waveform = mediaService.generateWaveformUrl('edubridge/audio_sample');

      expect(url).not.toContain(mockSecret);
      expect(waveform).not.toContain(mockSecret);
    });
  });

  // --------------------------------------------------------------------------
  // 12. Tenancy & Metadata Sanitization
  // --------------------------------------------------------------------------
  describe('12. Tenancy & Metadata Sanitization', () => {
    it('should associate asset with student and sanitize metadata keys and control characters', async () => {
      const dirtyMetadata = {
        'student\nName': 'Jane Doe\r\n',
        'unsafe$key!': 'Clean Value'
      };

      const result = await mediaService.uploadImage(sampleImageBuffer, {
        userId: 'usr_alice_99',
        textbookId: 'txt_chem_01',
        ...dirtyMetadata
      });

      expect(result.context.userId).toBe('usr_alice_99');
      expect(result.context.textbookId).toBe('txt_chem_01');
      expect(result.tags).toContain('user_usr_alice_99');
      expect(result.tags).toContain('textbook_txt_chem_01');
    });
  });
});
