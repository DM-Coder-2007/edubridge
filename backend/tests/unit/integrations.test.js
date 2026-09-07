/**
 * EduBridge Adaptive - Unit Tests: External Integrations
 * Tests Cloudinary, Gemini, Piper TTS, and faster-whisper
 */

const cloudinary = require('../../src/integrations/cloudinary');
const gemini = require('../../src/integrations/gemini');
const piper = require('../../src/integrations/piper');
const whisper = require('../../src/integrations/whisper');

describe('Integrations: Cloudinary Media Storage', () => {
  it('should upload an image buffer and return accessible metadata', async () => {
    const dummyImageBuffer = Buffer.from('fake-image-bytes-jpeg');
    const result = await cloudinary.uploadImage(dummyImageBuffer, {
      folder: 'edubridge/textbooks/raw',
      tags: ['test']
    });

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.publicId).toContain('edubridge/textbooks/raw');
    expect(result.width).toBe(1600);
  });

  it('should upload an audio MP3 buffer for lesson narration', async () => {
    const dummyAudioBuffer = Buffer.from('fake-audio-bytes-mp3');
    const result = await cloudinary.uploadAudio(dummyAudioBuffer, {
      folder: 'edubridge/audio',
      lessonId: 'les-12345',
      duration: 85.5
    });

    expect(result).toBeDefined();
    expect(result.url).toContain('.mp3');
    expect(result.duration).toBe(85.5);
    expect(result.publicId).toContain('audio_lesson_les-12345');
  });

  it('should generate accessible Cloudinary image transformation URLs', () => {
    const publicId = 'edubridge/textbooks/processed/biology_p1';
    const url = cloudinary.generateAccessibleImageUrl(publicId, {
      highContrast: true,
      zoomWidth: 2000,
      invert: true
    });

    expect(url).toContain('w_2000');
    expect(url).toContain('e_contrast:50');
    expect(url).toContain('e_negate');
    expect(url).toContain(publicId);
  });
});

describe('Integrations: Piper TTS (Local Neural Speech Engine)', () => {
  it('should synthesize audio narration from text', async () => {
    const text = 'Welcome to EduBridge. Today we will explore cell division using sound and tactile analogies.';
    const result = await piper.synthesize(text, { speakingRate: 1.0 });

    expect(result).toBeDefined();
    expect(result.audioBuffer).toBeDefined();
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(['mp3', 'wav']).toContain(result.format);
  });
});

describe('Integrations: faster-whisper (Speech Recognition)', () => {
  it('should transcribe audio buffer to text', async () => {
    const dummyVoiceBuffer = Buffer.from('student-voice-recording-bytes');
    const result = await whisper.transcribe(dummyVoiceBuffer);

    expect(result).toBeDefined();
    expect(typeof result.transcript).toBe('string');
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

describe('Integrations: Google Gemini Multimodal AI', () => {
  it('should extract text and diagram audio descriptions from textbook scan', async () => {
    const dummyBuffer = Buffer.from('scanned-book-page');
    const result = await gemini.extractAndUnderstandTextbook(dummyBuffer, 'image/jpeg', 'test_ocr');

    expect(result).toBeDefined();
    expect(result.extractedText).toBeDefined();
    expect(Array.isArray(result.diagramDescriptions)).toBe(true);
    expect(result.diagramDescriptions.length).toBeGreaterThan(0);
    expect(Array.isArray(result.keyTopics)).toBe(true);
  });

  it('should generate accessible lesson with sensory analogies', async () => {
    const result = await gemini.generateLessonFromContent({
      textbookTitle: 'Plant Biology',
      subject: 'Science',
      extractedContent: 'Plant cells have cell walls and chloroplasts.',
      diagramDescriptions: ['A rectangular cell with green chloroplast discs.'],
      entityId: 'test_lesson'
    });

    expect(result).toBeDefined();
    expect(result.title).toBeDefined();
    expect(result.simplifiedText).toBeDefined();
    expect(result.screenReaderTranscript).toBeDefined();
    expect(Array.isArray(result.concepts)).toBe(true);
    expect(result.concepts[0]).toBeDefined();
  });

  it('should generate quiz questions for lesson concepts', async () => {
    const questions = await gemini.generateQuestionsForLesson({
      lessonTitle: 'Plant Cell Structure',
      subject: 'Biology',
      concepts: [{ name: 'Cell Wall' }, { name: 'Chloroplast' }]
    });

    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0].questionText).toBeDefined();
    expect(questions[0].correctAnswer).toBeDefined();
  });

  it('should evaluate student conceptual answers with feedback', async () => {
    const evalCorrect = await gemini.evaluateAnswer({
      questionText: 'What does the cell wall do?',
      correctAnswer: 'Providing rigid shape and structural protection',
      explanation: 'The wall protects the cell.',
      studentAnswer: 'It provides rigid shape and structure',
      entityId: 'test_eval_1'
    });

    expect(evalCorrect).toBeDefined();
    expect(evalCorrect.score).toBeDefined();
    expect(evalCorrect.feedback).toBeDefined();

    const evalIncorrect = await gemini.evaluateAnswer({
      questionText: 'What does the cell wall do?',
      correctAnswer: 'Providing rigid shape and structural protection',
      explanation: 'The wall protects the cell.',
      studentAnswer: 'It stores extra fat in animals',
      entityId: 'test_eval_2'
    });

    expect(evalIncorrect).toBeDefined();
    expect(evalIncorrect.score).toBeDefined();
  });
});
