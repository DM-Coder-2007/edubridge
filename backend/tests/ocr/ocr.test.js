/**
 * EduBridge Adaptive - Textbook Image OCR Processing Pipeline Test Suite
 *
 * CRITICAL ARCHITECTURE RULE:
 * Controller -> Service -> Integration.
 * No direct Gemini calls in route controllers.
 * Structured OCR schema: title, rawText, sections, concepts, formulas, examples.
 * Snowflake is the primary database.
 * Never silently lose failed jobs.
 *
 * Verifies:
 * 1. Valid textbook image end-to-end processing
 * 2. Low-quality image detection and adaptive enhancement
 * 3. Unsupported image format rejection
 * 4. Oversized image (>15MB) rejection
 * 5. Gemini failure handling & failure persistence in Snowflake
 * 6. Cloudinary upload failure handling & persistence in Snowflake
 * 7. Snowflake initialization failure handling
 * 8. Retry-safe behavior (recovering failed jobs)
 * 9. Structured OCR result retrieval
 */

const sharp = require('sharp');
const ocrService = require('../../src/services/ocr/ocr.service');
const imagePreprocessor = require('../../src/services/ocr/imagePreprocessor');
const ocrValidator = require('../../src/services/ocr/ocr.validator');
const mediaService = require('../../src/services/media/media.service');
const gemini = require('../../src/integrations/gemini');
const databaseManager = require('../../src/database/snowflake/databaseManager');
const connectionManager = require('../../src/database/snowflake/connection');

describe('EduBridge Textbook OCR Pipeline: End-to-End Test Suite', () => {
  let validTextbookBuffer;
  let lowQualityBuffer;

  beforeAll(async () => {
    // 1. Generate realistic 800x1000 test textbook scan in memory
    validTextbookBuffer = await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 3,
        background: { r: 250, g: 250, b: 245 }
      }
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="800" height="1000"><text x="50" y="100" font-size="32" fill="#111">Chapter 4: Plant Cell Structure</text><text x="50" y="200" font-size="18" fill="#333">Cell walls consist of cellulose fibers.</text></svg>'
          ),
          top: 0,
          left: 0
        }
      ])
      .jpeg()
      .toBuffer();

    // 2. Generate low-resolution 250x250 scan to test low-quality branch
    lowQualityBuffer = await sharp({
      create: {
        width: 250,
        height: 250,
        channels: 3,
        background: { r: 180, g: 180, b: 180 }
      }
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    // Initialize fresh mock Snowflake database state for test isolation
    connectionManager.resetMockStore();
    connectionManager.setCurrentDatabase('EDUBRIDGE_ADAPTIVE');
    connectionManager.setCurrentSchema('APP');
    await databaseManager.initializeDatabase();
  });

  // --------------------------------------------------------------------------
  // 1. Valid Textbook Image End-to-End Processing
  // --------------------------------------------------------------------------
  describe('1. Valid Textbook Image Processing', () => {
    it('should execute complete pipeline and store structured OCR in Snowflake', async () => {
      const result = await ocrService.processTextbookImage({
        buffer: validTextbookBuffer,
        userId: 'usr_student_alpha',
        title: 'Biology Chapter 4: Plant Cells',
        subject: 'Biology',
        chapterTitle: 'Organelles and Walls',
        gradeLevel: 'Grade 9',
        mimeType: 'image/jpeg'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.assetId).toBeDefined();

      // Verify Cloudinary media URLs
      expect(result.media.rawImageUrl).toBeDefined();
      expect(result.media.processedImageUrl).toBeDefined();
      expect(result.media.accessibleImageUrl).toContain('w_2000');

      // Verify canonical structured OCR output
      const ocr = result.structuredOcr;
      expect(ocr).toBeDefined();
      expect(ocr.title).toContain('Plant');
      expect(ocr.rawText).toBeDefined();
      expect(ocr.rawText.length).toBeGreaterThan(10);
      expect(Array.isArray(ocr.sections)).toBe(true);
      expect(Array.isArray(ocr.concepts)).toBe(true);
      expect(Array.isArray(ocr.formulas)).toBe(true);
      expect(Array.isArray(ocr.examples)).toBe(true);
      expect(Array.isArray(ocr.diagramDescriptions)).toBe(true);
      expect(ocr.qualityMetrics.confidenceScore).toBeGreaterThan(0);

      // Verify Snowflake persistence
      const rows = await databaseManager.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ?',
        [result.assetId]
      );
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.PROCESSING_STATUS).toBe('COMPLETED');
      expect(row.RAW_IMAGE_URL).toBeDefined();
      expect(row.OCR_EXTRACTED_TEXT).toBe(ocr.rawText);
      expect(row.ERROR_MESSAGE).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Low-Quality Image Detection & Enhancement
  // --------------------------------------------------------------------------
  describe('2. Low-Quality Image Handling', () => {
    it('should detect low-resolution scan, apply adaptive enhancements, and record metrics', async () => {
      const result = await ocrService.processTextbookImage({
        buffer: lowQualityBuffer,
        userId: 'usr_student_alpha',
        title: 'Low Res Handout Scan',
        subject: 'General Science',
        mimeType: 'image/jpeg'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.structuredOcr.qualityMetrics.isLowQuality).toBe(true);

      // Check Snowflake stored AI metadata indicates low quality
      const rows = await databaseManager.query(
        'SELECT AI_METADATA FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE ID = ?',
        [result.assetId]
      );
      const aiMeta = typeof rows[0].AI_METADATA === 'string'
        ? JSON.parse(rows[0].AI_METADATA)
        : rows[0].AI_METADATA;

      expect(aiMeta.isLowQuality).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Unsupported Image Rejection
  // --------------------------------------------------------------------------
  describe('3. Unsupported Image Format Rejection', () => {
    it('should reject unsupported file formats (PDF, GIF, HTML) before starting pipeline', async () => {
      await expect(
        ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Document PDF',
          subject: 'History',
          mimeType: 'application/pdf'
        })
      ).rejects.toThrow(/Unsupported file type "application\/pdf"/);

      await expect(
        ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Animated GIF',
          subject: 'Art',
          mimeType: 'image/gif'
        })
      ).rejects.toThrow(/Unsupported file type "image\/gif"/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Oversized Image Rejection
  // --------------------------------------------------------------------------
  describe('4. Oversized Image Rejection', () => {
    it('should reject images exceeding the 15MB maximum size limit', async () => {
      const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB

      await expect(
        ocrService.processTextbookImage({
          buffer: oversizedBuffer,
          userId: 'usr_student_alpha',
          title: 'Huge Scan File',
          subject: 'Geography',
          mimeType: 'image/jpeg'
        })
      ).rejects.toThrow(/Textbook image exceeds maximum permitted size of 15MB/);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Gemini Failure Handling & Persistence in Snowflake
  // --------------------------------------------------------------------------
  describe('5. Gemini Multimodal Processing Failure', () => {
    it('should capture Gemini failure, mark job FAILED in Snowflake, and persist error', async () => {
      // Mock Gemini failure
      const geminiSpy = jest.spyOn(gemini, 'extractAndUnderstandTextbook').mockRejectedValueOnce(
        new Error('Gemini quota exceeded or multimodal vision service unavailable')
      );

      let thrownError;
      try {
        await ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Failing Gemini Scan',
          subject: 'Physics',
          mimeType: 'image/jpeg'
        });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('Gemini quota exceeded');

      // Verify job was NOT silently lost! Snowflake must reflect FAILED state
      const rows = await databaseManager.query(
        "SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE TITLE = 'Failing Gemini Scan'"
      );
      expect(rows.length).toBe(1);
      const failedAsset = rows[0];
      expect(failedAsset.PROCESSING_STATUS).toBe('FAILED');
      expect(failedAsset.ERROR_MESSAGE).toContain('Gemini quota exceeded');
      expect(Number(failedAsset.RETRY_COUNT)).toBe(1);

      geminiSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Cloudinary Upload Failure Handling & Persistence
  // --------------------------------------------------------------------------
  describe('6. Cloudinary Upload Failure', () => {
    it('should capture Cloudinary upload failure and mark status FAILED in Snowflake', async () => {
      const uploadSpy = jest.spyOn(mediaService, 'uploadImage').mockRejectedValueOnce(
        new Error('Cloudinary network timeout connecting to upload server')
      );

      let thrownError;
      try {
        await ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Failing Cloudinary Scan',
          subject: 'Chemistry',
          mimeType: 'image/jpeg'
        });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('Cloudinary network timeout');

      // Verify failure persisted in Snowflake
      const rows = await databaseManager.query(
        "SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE TITLE = 'Failing Cloudinary Scan'"
      );
      expect(rows.length).toBe(1);
      const failedAsset = rows[0];
      expect(failedAsset.PROCESSING_STATUS).toBe('FAILED');
      expect(failedAsset.ERROR_MESSAGE).toContain('Cloudinary network timeout');

      uploadSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Snowflake Failure Handling
  // --------------------------------------------------------------------------
  describe('7. Snowflake Failure Handling', () => {
    it('should throw descriptive error when Snowflake is unavailable during init', async () => {
      const insertSpy = jest.spyOn(databaseManager, 'insert').mockRejectedValueOnce(
        new Error('Snowflake connection timeout or warehouse suspended')
      );

      await expect(
        ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Snowflake Failure Test',
          subject: 'Math',
          mimeType: 'image/jpeg'
        })
      ).rejects.toThrow(/Snowflake error during job initialization/);

      insertSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // 8. Retry-Safe Behavior
  // --------------------------------------------------------------------------
  describe('8. Retry-Safe Behavior', () => {
    it('should safely retry a failed job and advance it to COMPLETED with incremented retry count', async () => {
      // 1. First simulate a failure
      const geminiSpy = jest.spyOn(gemini, 'extractAndUnderstandTextbook').mockRejectedValueOnce(
        new Error('Transient AI service error')
      );

      let assetId;
      try {
        await ocrService.processTextbookImage({
          buffer: validTextbookBuffer,
          userId: 'usr_student_alpha',
          title: 'Retryable Textbook Page',
          subject: 'Astronomy',
          mimeType: 'image/jpeg'
        });
      } catch (err) {
        // Find created failed asset ID
        const failedRows = await databaseManager.query(
          "SELECT ID FROM EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS WHERE TITLE = 'Retryable Textbook Page'"
        );
        assetId = failedRows[0].ID;
      }

      geminiSpy.mockRestore();

      expect(assetId).toBeDefined();

      // Check initial failed state
      let assetState = await ocrService.getOcrResult(assetId);
      expect(assetState.status).toBe('FAILED');
      expect(assetState.retryCount).toBe(1);

      // 2. Execute retry
      const retryResult = await ocrService.retryProcessing(assetId, validTextbookBuffer);

      expect(retryResult.success).toBe(true);
      expect(retryResult.status).toBe('COMPLETED');

      // Check final state in Snowflake
      assetState = await ocrService.getOcrResult(assetId);
      expect(assetState.status).toBe('COMPLETED');
      expect(assetState.retryCount).toBe(2);
      expect(assetState.errorMessage).toBeNull();
      expect(assetState.structuredOcr.rawText).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Structured OCR Result Retrieval
  // --------------------------------------------------------------------------
  describe('9. Structured OCR Result Retrieval', () => {
    it('should return null for non-existent asset ID', async () => {
      const result = await ocrService.getOcrResult('non_existent_asset_id');
      expect(result).toBeNull();
    });

    it('should retrieve structured OCR breakdown for completed asset', async () => {
      const processed = await ocrService.processTextbookImage({
        buffer: validTextbookBuffer,
        userId: 'usr_student_alpha',
        title: 'Photosynthesis Deep Dive',
        subject: 'Botany',
        mimeType: 'image/jpeg'
      });

      const retrieved = await ocrService.getOcrResult(processed.assetId);

      expect(retrieved).toBeDefined();
      expect(retrieved.assetId).toBe(processed.assetId);
      expect(retrieved.status).toBe('COMPLETED');
      expect(retrieved.structuredOcr.title).toBe('Photosynthesis Deep Dive');
      expect(Array.isArray(retrieved.structuredOcr.concepts)).toBe(true);
      expect(Array.isArray(retrieved.structuredOcr.diagramDescriptions)).toBe(true);
    });
  });
});
