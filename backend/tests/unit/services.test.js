/**
 * EduBridge Adaptive - Unit Tests: Core Services & Orchestration Pipeline
 */

const sharp = require('sharp');
const imageService = require('../../src/services/imageService');
const ttsService = require('../../src/services/ttsService');
const speechService = require('../../src/services/speechService');
const pipelineService = require('../../src/services/pipelineService');
const userRepository = require('../../src/repositories/userRepository');

describe('Services: Image Processing (Sharp)', () => {
  let sampleImageBuffer;

  beforeAll(async () => {
    // Generate valid 200x200 test JPEG image in memory
    sampleImageBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 240, g: 240, b: 240 }
      }
    }).jpeg().toBuffer();
  });

  it('should extract image metadata', async () => {
    const meta = await imageService.getImageMetadata(sampleImageBuffer);
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
    expect(meta.format).toBe('jpeg');
  });

  it('should preprocess image for OCR with histogram normalization and sharpening', async () => {
    const result = await imageService.preprocessForOCR(sampleImageBuffer);
    expect(result.buffer).toBeDefined();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.metadata.transformations).toContain('normalize_histogram');
  });

  it('should generate high contrast and inverted accessibility views', async () => {
    const highContrast = await imageService.generateAccessibilityView(sampleImageBuffer, 'high-contrast');
    expect(Buffer.isBuffer(highContrast)).toBe(true);

    const inverted = await imageService.generateAccessibilityView(sampleImageBuffer, 'inverted');
    expect(Buffer.isBuffer(inverted)).toBe(true);
  });
});

describe('Services: TTS Service (Piper TTS + Cloudinary)', () => {
  it('should generate lesson audio narration and upload to Cloudinary', async () => {
    const result = await ttsService.generateLessonNarration({
      lessonId: 'lesson-piper-test',
      text: 'This is an audio description of plant cells with Piper TTS.',
      options: { speakingRate: 1.0 }
    });

    expect(result.audioUrl).toBeDefined();
    expect(result.audioPublicId).toBeDefined();
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.waveformUrl).toBeDefined();
  });
});

describe('Services: Speech Recognition Service (faster-whisper)', () => {
  it('should transcribe student voice answer', async () => {
    const voiceBuffer = Buffer.from('mock-voice-recording');
    const result = await speechService.transcribeVoiceAnswer(voiceBuffer);

    expect(result.transcript).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

describe('Services: Pipeline Service (End-to-End Orchestration)', () => {
  let testUser;
  let sampleImageBuffer;

  beforeAll(async () => {
    testUser = await userRepository.create({
      email: `pipeline_${Date.now()}@edubridge.org`,
      passwordHash: 'hash1234',
      fullName: 'Pipeline Test Student'
    });

    sampleImageBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 250, g: 250, b: 250 }
      }
    }).jpeg().toBuffer();
  });

  it('should execute complete multi-stage pipeline and persist results to Snowflake', async () => {
    const pipelineResult = await pipelineService.processTextbookScan({
      imageBuffer: sampleImageBuffer,
      userId: testUser.id,
      title: 'Science 101 - Cell Organelles',
      subject: 'Biology',
      gradeLevel: 'Grade 8',
      chapterTitle: 'Microscopic Life'
    });

    expect(pipelineResult).toBeDefined();

    // 1. Textbook scan persisted in Snowflake
    expect(pipelineResult.textbook).toBeDefined();
    expect(pipelineResult.textbook.id).toBeDefined();
    expect(pipelineResult.textbook.processingStatus).toBe('COMPLETED');
    expect(pipelineResult.textbook.rawImageUrl).toBeDefined();
    expect(pipelineResult.textbook.processedImageUrl).toBeDefined();

    // 2. Lesson generated and persisted in Snowflake
    expect(pipelineResult.lesson).toBeDefined();
    expect(pipelineResult.lesson.id).toBeDefined();
    expect(pipelineResult.lesson.audioUrl).toBeDefined();
    expect(pipelineResult.lesson.audioDurationSeconds).toBeGreaterThan(0);

    // 3. Concepts extracted with sensory analogies
    expect(Array.isArray(pipelineResult.concepts)).toBe(true);
    expect(pipelineResult.concepts.length).toBeGreaterThan(0);

    // 4. Questions generated for quiz
    expect(Array.isArray(pipelineResult.questions)).toBe(true);
    expect(pipelineResult.questions.length).toBeGreaterThan(0);
  });
});
