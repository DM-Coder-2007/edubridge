/**
 * EduBridge Adaptive - End-to-End Accessible Learning Pipeline
 * 
 * Orchestrates:
 * 1. Image preprocessing with Sharp (normalization, high contrast, auto-orientation)
 * 2. Upload of raw & enhanced images to Cloudinary (Mandatory media layer)
 * 3. Multimodal OCR & tactile diagram descriptions via Gemini AI
 * 4. Structured accessible lesson generation with sensory/tactile analogies
 * 5. Audio narration synthesis via Piper TTS and MP3 upload to Cloudinary
 * 6. Comprehension question generation with voice prompt hints
 * 7. Real-time audit and state persistence into Snowflake (Primary database)
 */

const imageService = require('./imageService');
const cloudinary = require('../integrations/cloudinary');
const gemini = require('../integrations/gemini');
const ttsService = require('./ttsService');

const textbookRepository = require('../repositories/textbookRepository');
const processingStatusRepository = require('../repositories/processingStatusRepository');
const lessonRepository = require('../repositories/lessonRepository');
const conceptRepository = require('../repositories/conceptRepository');
const quizRepository = require('../repositories/quizRepository');
const logger = require('../utils/logger');

class PipelineService {
  async processTextbookScan({
    imageBuffer,
    userId,
    title,
    subject,
    gradeLevel = 'Middle School',
    chapterTitle = null,
    voicePreferences = {}
  }) {
    logger.info(`[Pipeline] Initiating accessibility pipeline for "${title}" (${subject})`);

    // 1. Sharp preprocessing
    const preprocessResult = await imageService.preprocessForOCR(imageBuffer);

    // 2. Upload raw & processed scans to Cloudinary
    const rawUpload = await cloudinary.uploadImage(imageBuffer, {
      folder: 'edubridge/textbooks/raw',
      tags: ['raw', `user_${userId}`]
    });

    const processedUpload = await cloudinary.uploadImage(preprocessResult.buffer, {
      folder: 'edubridge/textbooks/processed',
      tags: ['processed', `user_${userId}`]
    });

    // 3. Persist Textbook in Snowflake
    const textbook = await textbookRepository.create({
      userId,
      title,
      subject,
      gradeLevel,
      chapterTitle,
      rawImageUrl: rawUpload.url,
      rawImagePublicId: rawUpload.publicId,
      processedImageUrl: processedUpload.url,
      processedImagePublicId: processedUpload.publicId,
      processingStatus: 'PREPROCESSING_COMPLETED',
      metadata: preprocessResult.metadata
    });

    await processingStatusRepository.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbook.id,
      stage: 'CLOUDINARY_UPLOAD',
      status: 'SUCCESS',
      progressPercent: 20.0,
      metadata: { rawUrl: rawUpload.url, processedUrl: processedUpload.url }
    });

    // 4. Gemini Multimodal OCR
    await textbookRepository.updateProcessingStatus(textbook.id, 'OCR_ANALYZING');
    await processingStatusRepository.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbook.id,
      stage: 'GEMINI_OCR',
      status: 'IN_PROGRESS',
      progressPercent: 35.0
    });

    const ocrResult = await gemini.extractAndUnderstandTextbook(
      preprocessResult.buffer,
      'image/jpeg',
      textbook.id
    );

    await processingStatusRepository.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbook.id,
      stage: 'GEMINI_OCR',
      status: 'SUCCESS',
      progressPercent: 50.0,
      metadata: { topicsCount: ocrResult.keyTopics?.length || 0 }
    });

    // 5. Gemini Accessible Lesson Generation
    await textbookRepository.updateProcessingStatus(textbook.id, 'GENERATING_LESSON');
    await processingStatusRepository.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbook.id,
      stage: 'GEMINI_LESSON',
      status: 'IN_PROGRESS',
      progressPercent: 65.0
    });

    const generatedLesson = await gemini.generateLessonFromContent({
      textbookTitle: title,
      subject,
      gradeLevel,
      extractedContent: ocrResult.extractedText,
      diagramDescriptions: ocrResult.diagramDescriptions,
      entityId: textbook.id
    });

    // 6. Persist Lesson and Concepts in Snowflake
    const lesson = await lessonRepository.create({
      textbookId: textbook.id,
      userId,
      title: generatedLesson.title || `${title} - Accessible Lesson`,
      summary: generatedLesson.summary,
      simplifiedText: generatedLesson.simplifiedText,
      screenReaderTranscript: generatedLesson.screenReaderTranscript,
      difficultyLevel: 'beginner',
      status: 'DRAFT'
    });

    const persistedConcepts = [];
    if (generatedLesson.concepts && Array.isArray(generatedLesson.concepts)) {
      for (let i = 0; i < generatedLesson.concepts.length; i++) {
        const c = generatedLesson.concepts[i];
        const concept = await conceptRepository.create({
          lessonId: lesson.id,
          name: c.name,
          explanation: c.explanation,
          simplifiedAnalogy: c.simplifiedAnalogy,
          audioCueHint: c.audioCueHint,
          orderIndex: i
        });
        persistedConcepts.push(concept);
      }
    }

    // 7. Piper TTS Audio Narration & Cloudinary Upload
    await textbookRepository.updateProcessingStatus(textbook.id, 'SYNTHESIZING_AUDIO');
    await processingStatusRepository.logStage({
      entityType: 'LESSON',
      entityId: lesson.id,
      stage: 'PIPER_TTS',
      status: 'IN_PROGRESS',
      progressPercent: 80.0
    });

    const narration = await ttsService.generateLessonNarration({
      lessonId: lesson.id,
      text: lesson.simplifiedText,
      options: {
        speakingRate: voicePreferences.speakingRate || 1.0,
        pitch: voicePreferences.pitch || 0.0,
        voice: voicePreferences.voice
      }
    });

    const updatedLesson = await lessonRepository.updateAudio(lesson.id, {
      audioUrl: narration.audioUrl,
      audioPublicId: narration.audioPublicId,
      audioDurationSeconds: narration.durationSeconds,
      waveformUrl: narration.waveformUrl
    });

    await processingStatusRepository.logStage({
      entityType: 'LESSON',
      entityId: lesson.id,
      stage: 'PIPER_TTS',
      status: 'SUCCESS',
      progressPercent: 90.0,
      metadata: { audioUrl: narration.audioUrl, durationSeconds: narration.durationSeconds }
    });

    // 8. Gemini Question Generation
    const rawQuestions = await gemini.generateQuestionsForLesson({
      lessonTitle: updatedLesson.title,
      subject,
      concepts: persistedConcepts,
      count: 3,
      entityId: lesson.id
    });

    const persistedQuestions = [];
    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      const matchingConcept = persistedConcepts[i % persistedConcepts.length];
      const question = await quizRepository.createQuestion({
        lessonId: lesson.id,
        conceptId: matchingConcept ? matchingConcept.id : null,
        questionText: q.questionText,
        questionType: q.questionType || 'MULTIPLE_CHOICE',
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        audioPromptHint: q.audioPromptHint,
        difficultyLevel: q.difficultyLevel || 'medium',
        orderIndex: i
      });
      persistedQuestions.push(question);
    }

    // 9. Mark Complete
    const finalTb = await textbookRepository.updateProcessingStatus(textbook.id, 'COMPLETED');
    await processingStatusRepository.logStage({
      entityType: 'TEXTBOOK',
      entityId: textbook.id,
      stage: 'COMPLETED',
      status: 'SUCCESS',
      progressPercent: 100.0
    });

    logger.info(`[Pipeline] Pipeline completed for textbook ${textbook.id} & lesson ${lesson.id}`);

    return {
      textbook: finalTb,
      lesson: updatedLesson,
      concepts: persistedConcepts,
      questions: persistedQuestions
    };
  }
}

module.exports = new PipelineService();
