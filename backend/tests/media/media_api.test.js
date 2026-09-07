/**
 * EduBridge Adaptive - Cloudinary Media Infrastructure End-to-End API Test Suite
 *
 * Mandated Verification for Phase 4:
 * 1. Cloudinary configuration loading
 * 2. Cloudinary health check (GET /api/media/health & GET /api/health/cloudinary)
 * 3. Valid image validation (MIME, magic bytes, dimensions)
 * 4. Invalid MIME rejection (400)
 * 5. Oversized file rejection (15MB image / 50MB audio)
 * 6. Textbook image upload (POST /api/media/textbook)
 * 7. Secure HTTPS URL generation
 * 8. OCR transformation URL generation (GET /api/media/textbook/:assetId/ocr-url)
 * 9. Thumbnail URL generation
 * 10. Audio upload (POST /api/media/audio)
 * 11. Waveform URL generation (GET /api/media/audio/:audioId/waveform)
 * 12. Asset metadata retrieval (GET /api/media/textbook/:assetId & GET /api/media/audio/:audioId)
 * 13. Asset deletion (DELETE /api/media/textbook/:assetId)
 * 14. User isolation enforcement (Student A cannot access or delete Student B's media -> 403 Forbidden)
 * 15. Missing asset handling (404 Not Found)
 * 16. Cloudinary failure handling (graceful error return)
 * 17. Snowflake metadata failure handling
 * 18. Zero secret leakage in logs, responses, and URLs
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_edubridge_adaptive_auth_verification_key_32bytes';
process.env.CLOUDINARY_MOCK_FALLBACK = 'true';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const MOCK_SECRET = 'super_secret_cloudinary_key_phase4_xyz!';
process.env.CLOUDINARY_API_SECRET = MOCK_SECRET;

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const databaseManager = require('../../src/database/snowflake/databaseManager');
const cloudinaryClient = require('../../src/integrations/cloudinary/client');
const transformationService = require('../../src/integrations/cloudinary/transformation.service');
const mediaRepository = require('../../src/repositories/media.repository');

describe('Phase 4: Cloudinary Media Infrastructure End-to-End API Suite', () => {
  const timestamp = Date.now();
  let studentACookie = null;
  let studentAId = null;
  let studentBCookie = null;
  let studentBId = null;

  let sampleImageBuffer;
  let sampleAudioBuffer;

  let createdTextbookAssetId = null;
  let createdAudioId = null;

  beforeAll(async () => {
    // 1. Initialize Snowflake in-memory schema
    await databaseManager.initializeDatabase();

    // 2. Generate valid JPEG image fixture
    sampleImageBuffer = await sharp({
      create: {
        width: 400,
        height: 500,
        channels: 3,
        background: { r: 245, g: 245, b: 245 }
      }
    })
      .jpeg()
      .toBuffer();

    // 3. Generate valid MP3 audio fixture (ID3v2 header)
    sampleAudioBuffer = Buffer.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0xff, 0xfb,
      0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    // 4. Register Student A
    const signupARes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `student_a_phase4_${timestamp}@edubridge.org`,
        password: 'Password123!',
        fullName: 'Student A Phase4',
        role: 'student',
        gradeLevel: 'Grade 9'
      });
    expect(signupARes.status).toBe(201);
    studentAId = signupARes.body.data.user.id;
    studentACookie = signupARes.headers['set-cookie'];

    // 5. Register Student B (for user isolation tests)
    const signupBRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `student_b_phase4_${timestamp}@edubridge.org`,
        password: 'Password123!',
        fullName: 'Student B Phase4',
        role: 'student',
        gradeLevel: 'Grade 10'
      });
    expect(signupBRes.status).toBe(201);
    studentBId = signupBRes.body.data.user.id;
    studentBCookie = signupBRes.headers['set-cookie'];
  });

  beforeEach(() => {
    cloudinaryClient.resetMockStore();
  });

  // ==========================================================================
  // Requirement 1: Cloudinary Configuration Loading
  // ==========================================================================
  describe('1. Cloudinary Configuration Loading', () => {
    it('should properly load Cloudinary configuration with masked credentials', () => {
      const safeConfig = cloudinaryClient.getSafeConfig();
      expect(safeConfig).toBeDefined();
      expect(safeConfig.cloudName).toBeDefined();
      expect(safeConfig.baseFolder).toBe('edubridge');
      expect(safeConfig.secure).toBe(true);
      expect(safeConfig.apiKey).toMatch(/\*\*\*\*$/);
      expect(safeConfig.apiSecret).toBeUndefined();
    });
  });

  // ==========================================================================
  // Requirement 2: Cloudinary Health Check
  // ==========================================================================
  describe('2. Cloudinary Health Check Endpoints', () => {
    it('GET /api/media/health should return operational status', async () => {
      const res = await request(app).get('/api/media/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('cloudinary');
      expect(res.body.status).toBe('healthy');
      expect(res.body.cloudName).toBeDefined();
      expect(typeof res.body.latencyMs).toBe('number');
    });

    it('GET /api/health/cloudinary should report Cloudinary healthy status', async () => {
      const res = await request(app).get('/api/health/cloudinary');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('Cloudinary');
      expect(res.body.data.healthy).toBe(true);
    });
  });

  // ==========================================================================
  // Requirement 3: Valid Image Validation (MIME, Magic Bytes, Dimensions)
  // ==========================================================================
  describe('3. Valid Image Validation', () => {
    it('should validate and accept a valid JPEG textbook scan', async () => {
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Chapter 1: Cell Biology')
        .field('subject', 'Biology')
        .field('gradeLevel', 'Grade 9')
        .attach('image', sampleImageBuffer, 'cell_biology.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.format).toBe('jpg');
      expect(res.body.data.width).toBeGreaterThanOrEqual(10);
      expect(res.body.data.height).toBeGreaterThanOrEqual(10);
    });
  });

  // ==========================================================================
  // Requirement 4: Invalid MIME & Executable Rejection
  // ==========================================================================
  describe('4. Invalid MIME & Signature Rejection', () => {
    it('should reject non-image file formats with 400 Bad Request', async () => {
      const textBuffer = Buffer.from('This is a plain text file pretending to be an image');
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Text File')
        .attach('image', textBuffer, 'fake.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unsupported image format/i);
    });

    it('should reject executable file signatures with 400 Bad Request', async () => {
      // Windows MZ executable signature
      const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Malicious File')
        .attach('image', exeBuffer, 'malicious.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Executable files are strictly forbidden/i);
    });
  });

  // ==========================================================================
  // Requirement 5: Oversized File Rejection (15MB Image / 50MB Audio)
  // ==========================================================================
  describe('5. Oversized File Rejection', () => {
    it('should reject an image exceeding 15MB limit', async () => {
      const oversizedImage = Buffer.alloc(16 * 1024 * 1024);
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Massive Image')
        .attach('image', oversizedImage, 'oversized.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/File size limit exceeded/i);
    });

    it('should reject an audio file exceeding 50MB limit', async () => {
      const oversizedAudio = Buffer.alloc(51 * 1024 * 1024);
      const res = await request(app)
        .post('/api/media/audio')
        .set('Cookie', studentACookie)
        .field('lessonId', 'les_oversized_audio')
        .attach('audio', oversizedAudio, 'oversized.mp3');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/File size/i);
    });
  });

  // ==========================================================================
  // Requirement 6: Textbook Image Upload (POST /api/media/textbook)
  // ==========================================================================
  describe('6. Textbook Image Upload Endpoint', () => {
    it('POST /api/media/textbook should upload image and persist metadata in Snowflake', async () => {
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Chapter 2: Genetics')
        .field('subject', 'Biology')
        .field('gradeLevel', 'Grade 10')
        .field('chapterTitle', 'Mendelian Genetics')
        .attach('image', sampleImageBuffer, 'genetics_chapter2.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const asset = res.body.data;
      createdTextbookAssetId = asset.id || asset.assetId;
      expect(createdTextbookAssetId).toBeDefined();
      expect(asset.publicId).toContain('edubridge/textbooks/originals');
      expect(asset.secureUrl).toBeDefined();
      expect(asset.ocrUrl).toBeDefined();
      expect(asset.userId).toBe(studentAId);

      // Verify metadata in Snowflake
      const snowflakeRecord = await mediaRepository.findById(createdTextbookAssetId);
      expect(snowflakeRecord).toBeDefined();
      expect(snowflakeRecord.title).toBe('Chapter 2: Genetics');
      expect(snowflakeRecord.userId).toBe(studentAId);
    });

    it('POST /api/media/textbook should reject missing file', async () => {
      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'No File Attached');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_FILE');
    });

    it('POST /api/media/textbook should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/media/textbook')
        .attach('image', sampleImageBuffer, 'unauth.jpg');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // Requirement 7: Secure HTTPS URL Generation
  // ==========================================================================
  describe('7. Secure HTTPS URL Generation', () => {
    it('should guarantee all returned image and audio URLs use HTTPS', async () => {
      const res = await request(app)
        .get(`/api/media/textbook/${createdTextbookAssetId}`)
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.rawImageUrl).toMatch(/^https:\/\//);
      expect(data.ocrUrl).toMatch(/^https:\/\//);
      expect(data.thumbnailUrl).toMatch(/^https:\/\//);
      expect(data.optimizedUrl).toMatch(/^https:\/\//);
    });
  });

  // ==========================================================================
  // Requirement 8: OCR Transformation URL Generation
  // ==========================================================================
  describe('8. OCR Transformation URL Generation', () => {
    it('GET /api/media/textbook/:assetId/ocr-url should return OCR-enhanced URL parameters', async () => {
      const res = await request(app)
        .get(`/api/media/textbook/${createdTextbookAssetId}/ocr-url`)
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ocrUrl).toBeDefined();
      expect(res.body.data.ocrUrl).toMatch(/^https:\/\//);
      expect(res.body.data.ocrUrl).toContain('e_grayscale');
      expect(res.body.data.ocrUrl).toContain('e_contrast:60');
      expect(res.body.data.ocrUrl).toContain('e_sharpen:120');
      expect(res.body.data.ocrUrl).toContain('w_2000');
    });
  });

  // ==========================================================================
  // Requirement 9: Thumbnail URL Generation
  // ==========================================================================
  describe('9. Thumbnail URL Generation', () => {
    it('should generate properly cropped thumbnail URLs for dashboard display', () => {
      const publicId = 'edubridge/textbooks/originals/sample_textbook_1';
      const thumbUrl = transformationService.getThumbnailUrl(publicId, { width: 250, height: 250 });

      expect(thumbUrl).toMatch(/^https:\/\//);
      expect(thumbUrl).toContain('w_250');
      expect(thumbUrl).toContain('h_250');
      expect(thumbUrl).toContain('c_thumb');
      expect(thumbUrl).toContain(publicId);
    });
  });

  // ==========================================================================
  // Requirement 10: Audio Upload (POST /api/media/audio)
  // ==========================================================================
  describe('10. Audio Upload Endpoint', () => {
    it('POST /api/media/audio should upload audio narration and persist metadata in Snowflake', async () => {
      const res = await request(app)
        .post('/api/media/audio')
        .set('Cookie', studentACookie)
        .field('lessonId', 'les_biology_mitosis_101')
        .field('duration', '145.5')
        .field('voice', 'en_US-lessac-medium')
        .attach('audio', sampleAudioBuffer, 'mitosis_narration.mp3');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const audio = res.body.data;
      createdAudioId = audio.id || audio.audioId;

      expect(createdAudioId).toBeDefined();
      expect(audio.publicId).toContain('audio_lesson_les_biology_mitosis_101');
      expect(audio.audioUrl).toMatch(/^https:\/\//);
      expect(audio.streamingUrl).toMatch(/^https:\/\//);
      expect(audio.waveformUrl).toMatch(/^https:\/\//);
      expect(audio.format).toBe('mp3');
      expect(audio.userId).toBe(studentAId);
    });

    it('POST /api/media/audio should reject missing audio file', async () => {
      const res = await request(app)
        .post('/api/media/audio')
        .set('Cookie', studentACookie)
        .field('lessonId', 'les_no_audio');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_FILE');
    });
  });

  // ==========================================================================
  // Requirement 11: Waveform URL Generation
  // ==========================================================================
  describe('11. Waveform URL Generation Endpoint', () => {
    it('GET /api/media/audio/:audioId/waveform should return waveform visualizer URL', async () => {
      const res = await request(app)
        .get(`/api/media/audio/${createdAudioId}/waveform`)
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.waveformUrl).toBeDefined();
      expect(res.body.data.waveformUrl).toMatch(/^https:\/\//);
      expect(res.body.data.waveformUrl).toContain('fl_waveform');
      expect(res.body.data.waveformUrl).toContain('.png');
    });
  });

  // ==========================================================================
  // Requirement 12: Asset Metadata Retrieval
  // ==========================================================================
  describe('12. Asset Metadata Retrieval Endpoints', () => {
    it('GET /api/media/textbook/:assetId should retrieve textbook media asset metadata', async () => {
      const res = await request(app)
        .get(`/api/media/textbook/${createdTextbookAssetId}`)
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdTextbookAssetId);
      expect(res.body.data.title).toBe('Chapter 2: Genetics');
      expect(res.body.data.ocrUrl).toBeDefined();
    });

    it('GET /api/media/audio/:audioId should retrieve audio asset metadata and streaming URL', async () => {
      const res = await request(app)
        .get(`/api/media/audio/${createdAudioId}`)
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdAudioId);
      expect(res.body.data.streamingUrl).toBeDefined();
      expect(res.body.data.streamingUrl).toContain('br_128k');
    });
  });

  // ==========================================================================
  // Requirement 13: Asset Deletion with Snowflake & Cloudinary Cleanup
  // ==========================================================================
  describe('13. Asset Deletion Endpoint', () => {
    it('DELETE /api/media/textbook/:assetId should remove asset from Snowflake and Cloudinary', async () => {
      // Create dedicated asset for deletion test
      const uploadRes = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Temporary Asset to Delete')
        .attach('image', sampleImageBuffer, 'temp_delete.jpg');

      const tempAssetId = uploadRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/media/textbook/${tempAssetId}`)
        .set('Cookie', studentACookie);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify asset no longer exists in Snowflake
      const checkRes = await request(app)
        .get(`/api/media/textbook/${tempAssetId}`)
        .set('Cookie', studentACookie);

      expect(checkRes.status).toBe(404);
    });
  });

  // ==========================================================================
  // Requirement 14: User Isolation Enforcement (Student A vs Student B)
  // ==========================================================================
  describe('14. User Isolation & Security Enforcement', () => {
    it('should reject Student B accessing Student A textbook asset with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/media/textbook/${createdTextbookAssetId}`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject Student B deleting Student A textbook asset with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/media/textbook/${createdTextbookAssetId}`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject Student B accessing Student A audio asset with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/media/audio/${createdAudioId}`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================================================
  // Requirement 15: Missing Asset Handling (404 Not Found)
  // ==========================================================================
  describe('15. Missing Asset Handling', () => {
    it('GET /api/media/textbook/:assetId should return 404 for non-existent asset', async () => {
      const res = await request(app)
        .get('/api/media/textbook/non_existent_textbook_asset_999')
        .set('Cookie', studentACookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('DELETE /api/media/textbook/:assetId should return 404 for non-existent asset', async () => {
      const res = await request(app)
        .delete('/api/media/textbook/non_existent_textbook_asset_999')
        .set('Cookie', studentACookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('GET /api/media/audio/:audioId should return 404 for non-existent audio', async () => {
      const res = await request(app)
        .get('/api/media/audio/non_existent_audio_asset_999')
        .set('Cookie', studentACookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // Requirement 16: Cloudinary Failure Handling
  // ==========================================================================
  describe('16. Cloudinary Failure Handling', () => {
    it('should handle ping failure gracefully in health check and return 503', async () => {
      const pingSpy = jest.spyOn(cloudinaryClient, 'ping').mockResolvedValueOnce({
        status: 'error',
        connected: false,
        mode: 'LIVE_CLOUDINARY',
        error: 'Cloudinary gateway unreachable',
        latencyMs: 1200
      });

      const res = await request(app).get('/api/media/health');
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe('unhealthy');

      pingSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Requirement 17: Snowflake Metadata Failure Handling
  // ==========================================================================
  describe('17. Snowflake Metadata Failure Handling', () => {
    it('should continue gracefully with Cloudinary result if Snowflake insert fails during upload', async () => {
      const insertSpy = jest.spyOn(mediaRepository, 'create').mockRejectedValueOnce(
        new Error('Snowflake connection transient failure')
      );

      const res = await request(app)
        .post('/api/media/textbook')
        .set('Cookie', studentACookie)
        .field('title', 'Resilient Upload Scan')
        .attach('image', sampleImageBuffer, 'resilient_scan.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.secureUrl).toBeDefined();

      insertSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Requirement 18: Zero Secret Leakage
  // ==========================================================================
  describe('18. Zero Secret Leakage Verification', () => {
    it('should never expose CLOUDINARY_API_SECRET in any HTTP responses or transformation URLs', async () => {
      // 1. Check health response
      const healthRes = await request(app).get('/api/media/health');
      expect(JSON.stringify(healthRes.body)).not.toContain(MOCK_SECRET);

      // 2. Check textbook metadata response
      const textbookRes = await request(app)
        .get(`/api/media/textbook/${createdTextbookAssetId}`)
        .set('Cookie', studentACookie);
      expect(JSON.stringify(textbookRes.body)).not.toContain(MOCK_SECRET);

      // 3. Check audio metadata response
      const audioRes = await request(app)
        .get(`/api/media/audio/${createdAudioId}`)
        .set('Cookie', studentACookie);
      expect(JSON.stringify(audioRes.body)).not.toContain(MOCK_SECRET);

      // 4. Check error responses
      const errRes = await request(app)
        .get('/api/media/textbook/not_found_test')
        .set('Cookie', studentACookie);
      expect(JSON.stringify(errRes.body)).not.toContain(MOCK_SECRET);
    });
  });
});
