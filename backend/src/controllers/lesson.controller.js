/**
 * EduBridge Adaptive - Lesson Controller
 *
 * Handles HTTP requests for:
 * - GET  /api/lessons/:id (get full accessible lesson)
 * - POST /api/lessons/:id/generate (trigger Gemini lesson generation)
 * - POST /api/lessons/:id/regenerate (regenerate lesson with simpler analogies or difficulty shift)
 * - GET  /api/lessons/:id/questions (get comprehension questions for lesson)
 * - POST /api/lessons/:id/audio (synthesize Piper TTS narration and upload to Cloudinary)
 * - GET  /api/lessons/:id/audio (retrieve audio metadata, waveform, and streaming URL)
 * - GET  /api/lessons/:id/mastery (retrieve student mastery across lesson concepts)
 *
 * Architecture: Controller -> Service -> Repository -> Snowflake
 */

const lessonRepository = require('../repositories/lesson.repository');
const questionRepository = require('../repositories/question.repository');
const audioRepository = require('../repositories/audio.repository');
const masteryRepository = require('../repositories/mastery.repository');
const mediaRepository = require('../repositories/media.repository');
const progressRepository = require('../repositories/progressRepository');
const gemini = require('../integrations/gemini');
const ttsService = require('../services/ttsService');
const ApiResponse = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class LessonController {
  /**
   * GET /api/lessons
   * List all lessons for authenticated user enriched with textbook media, progress, and mastery
   */
  async listLessons(req, res, next) {
    try {
      const userId = req.user.id;
      logger.info(`[LessonController] Listing lessons for user ${userId}`);

      const [lessons, textbooks, progressList, masteries] = await Promise.all([
        lessonRepository.findByUserId(userId),
        mediaRepository.findByUserId(userId),
        progressRepository.getAllProgressForUser(userId),
        masteryRepository.findAllByUserId(userId)
      ]);

      const textbookMap = new Map();
      textbooks.forEach(tb => textbookMap.set(tb.id, tb));

      const progressMap = new Map();
      progressList.forEach(p => progressMap.set(p.lessonId, p));

      const enrichedLessons = lessons.map(lesson => {
        const tb = textbookMap.get(lesson.textbookAssetId) || textbookMap.get(lesson.textbookId);
        const prog = progressMap.get(lesson.id);

        let conceptCount = 0;
        if (Array.isArray(lesson.keyTakeaways)) {
          conceptCount = lesson.keyTakeaways.length;
        } else if (Array.isArray(tb?.metadata?.concepts)) {
          conceptCount = tb.metadata.concepts.length;
        } else if (Array.isArray(lesson.sensoryAnalogies)) {
          conceptCount = lesson.sensoryAnalogies.length;
        }

        const masteryScore = prog?.masteryScore !== undefined
          ? prog.masteryScore
          : (prog?.completionPercentage >= 100 ? 85 : 0);

        return {
          id: lesson.id,
          lessonId: lesson.id,
          title: lesson.title,
          summary: lesson.summary,
          subject: tb?.subject || 'General Science',
          chapterTitle: tb?.chapterTitle || null,
          textbookAssetId: lesson.textbookAssetId || lesson.textbookId || null,
          status: prog?.status || lesson.status || 'PUBLISHED',
          difficultyLevel: lesson.difficultyLevel || 'beginner',
          progress: prog?.completionPercentage || 0,
          completionPercentage: prog?.completionPercentage || 0,
          masteryScore,
          conceptCount: conceptCount || 3,
          hasAudio: Boolean(lesson.audioUrl),
          audioDurationSeconds: lesson.audioDurationSeconds || 0,
          thumbnailUrl: tb?.accessibleImageUrl || tb?.processedImageUrl || tb?.rawImageUrl || null,
          lastActivity: prog?.lastAccessedAt || lesson.updatedAt || lesson.createdAt,
          createdAt: lesson.createdAt,
          updatedAt: lesson.updatedAt
        };
      });

      return ApiResponse.success(res, 200, 'Lessons retrieved successfully', {
        lessons: enrichedLessons,
        count: enrichedLessons.length
      });
    } catch (error) {
      logger.error('[LessonController] listLessons error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/lessons/:id
   * Get single lesson details with analogies, transcript, and audio pointers
   */
  async getLessonById(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);

      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const questions = await questionRepository.findByLessonId(lesson.id);
      const audioAsset = await audioRepository.findByEntity('LESSON', lesson.id);

      return ApiResponse.success(res, 200, 'Lesson retrieved successfully', {
        lesson,
        questionsCount: questions.length,
        audio: audioAsset || {
          audioUrl: lesson.audioUrl,
          waveformUrl: lesson.waveformUrl,
          durationSeconds: lesson.audioDurationSeconds
        }
      });
    } catch (error) {
      logger.error('[LessonController] getLessonById error:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/lessons/:id/generate
   * Generate accessible lesson content using Gemini AI
   */
  async generateLesson(req, res, next) {
    try {
      const { id } = req.params;
      let lesson = await lessonRepository.findById(id);

      const textbookContent = req.body.rawText || req.body.extractedText || lesson?.simplifiedText || 'General science concepts.';
      const title = req.body.title || lesson?.title || 'Accessible Lesson';
      const subject = req.body.subject || 'Science';

      logger.info(`[LessonController] Generating Gemini lesson for lessonId=${id}: "${title}"`);

      const generated = await gemini.generateLessonFromContent({
        textbookTitle: title,
        subject,
        extractedContent: textbookContent,
        entityId: id
      });

      // Grounding validation step against extracted source
      const groundingResult = await gemini.validateGrounding({
        extractedSource: textbookContent,
        generatedLesson: generated,
        entityId: id
      });

      // Speech script formatting step for TTS narration
      const narrationScript = await gemini.generateSpeechScript({
        lesson: generated,
        entityId: id
      });

      const lessonStatus = (groundingResult.groundingScore >= 0.70 && (!groundingResult.unsupportedClaims || groundingResult.unsupportedClaims.length === 0))
        ? 'PUBLISHED'
        : 'NEEDS_REVIEW';

      const lessonPayload = {
        title: generated.title || title,
        summary: generated.summary,
        simplifiedText: generated.simplifiedText,
        screenReaderTranscript: narrationScript || generated.screenReaderTranscript || generated.simplifiedText,
        sourceContent: generated.sourceContent || { heading: title, paragraphs: [textbookContent] },
        aiExplanation: generated.aiExplanation || { simpleExplanation: generated.summary },
        sensoryAnalogies: generated.analogies || generated.sensoryAnalogies || [],
        keyTakeaways: generated.takeaways || generated.keyTakeaways || [],
        groundingScore: groundingResult.groundingScore,
        unsupportedClaims: groundingResult.unsupportedClaims || [],
        status: lessonStatus
      };

      if (!lesson) {
        lesson = await lessonRepository.create({
          id,
          textbookAssetId: req.body.textbookAssetId || 'txt_default',
          userId: req.user.id,
          ...lessonPayload,
          difficultyLevel: 'beginner'
        });
      } else {
        lesson = await lessonRepository.updateContent(id, lessonPayload);
      }

      // Generate associated assessment questions if requested
      if (req.body.generateQuestions !== false) {
        const questions = await gemini.generateQuestions({
          lessonTitle: lesson.title,
          subject,
          concepts: generated.concepts || generated.keyTakeaways || ['Core Concept'],
          count: 3,
          targetDifficulty: 'medium',
          entityId: id
        });

        if (Array.isArray(questions) && questions.length > 0) {
          await questionRepository.createMany(
            questions.map((q, idx) => ({
              lessonId: lesson.id,
              questionText: q.questionText,
              questionType: q.questionType || 'MULTIPLE_CHOICE',
              options: q.options || [],
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || '',
              audioPromptHint: q.audioPromptHint,
              difficultyLevel: q.difficultyLevel || 'medium',
              orderIndex: idx
            }))
          );
        }
      }

      return ApiResponse.success(res, 200, 'Lesson generated successfully via Gemini AI', {
        lesson: {
          ...lesson,
          grounding: groundingResult
        }
      });
    } catch (error) {
      logger.error('[LessonController] generateLesson error:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/lessons/:id/regenerate
   * Regenerate lesson with adaptive adjustments (simpler explanations, analogies, or audio)
   */
  async regenerateLesson(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);

      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const {
        targetDifficulty = 'easy',
        simplerExplanation = true,
        strugglingConcept = null
      } = req.body;

      logger.info(`[LessonController] Regenerating lesson ${id} with targetDifficulty=${targetDifficulty}`);

      let regeneratedContent = {};
      if (simplerExplanation) {
        const simpler = await gemini.generateSimplerExplanation({
          conceptName: strugglingConcept || lesson.title,
          originalExplanation: lesson.summary,
          difficultyLevel: targetDifficulty,
          entityId: id
        });

        regeneratedContent = {
          summary: simpler.simplerExplanation,
          simplifiedText: simpler.simplerExplanation,
          sensoryAnalogies: simpler.analogies ? [simpler.analogies] : lesson.sensoryAnalogies
        };
      }

      const updated = await lessonRepository.updateContent(id, {
        ...regeneratedContent,
        title: req.body.title || lesson.title
      });

      if (targetDifficulty) {
        await lessonRepository.updateStatus(id, lesson.status);
      }

      return ApiResponse.success(res, 200, 'Lesson regenerated successfully with cognitive adaptations', {
        lesson: updated
      });
    } catch (error) {
      logger.error('[LessonController] regenerateLesson error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/lessons/:id/questions
   * Get comprehension questions for the lesson
   */
  async getLessonQuestions(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);
      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const questions = await questionRepository.findByLessonId(id);
      return ApiResponse.success(res, 200, 'Lesson questions retrieved', {
        lessonId: id,
        questions,
        count: questions.length
      });
    } catch (error) {
      logger.error('[LessonController] getLessonQuestions error:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/lessons/:id/audio
   * Generate synthesized Piper TTS audio narration and upload to Cloudinary
   */
  async generateLessonAudio(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);
      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const { voice, speed = 1.0, pitch = 0.0 } = req.body;
      const textToSpeak = req.body.text || lesson.screenReaderTranscript || lesson.simplifiedText || lesson.summary;

      if (!textToSpeak) {
        throw new ValidationError('Lesson has no text available for speech synthesis.', { field: 'text' });
      }

      logger.info(`[LessonController] Synthesizing Piper TTS audio for lesson ${id}`);
      const audioResult = await ttsService.generateLessonNarration({
        lessonId: id,
        text: textToSpeak,
        options: {
          speakingRate: parseFloat(speed || 1.0),
          pitch: parseFloat(pitch || 0.0),
          voice
        }
      });

      // Update lesson pointers in Snowflake
      const updatedLesson = await lessonRepository.updateAudio(id, {
        audioUrl: audioResult.audioUrl,
        audioPublicId: audioResult.audioPublicId,
        audioDurationSeconds: audioResult.durationSeconds,
        waveformUrl: audioResult.waveformUrl
      });

      return ApiResponse.success(res, 201, 'Lesson audio synthesized via Piper TTS and saved to Cloudinary', {
        lessonId: id,
        audioUrl: audioResult.audioUrl,
        waveformUrl: audioResult.waveformUrl,
        durationSeconds: audioResult.durationSeconds,
        lesson: updatedLesson
      });
    } catch (error) {
      logger.error('[LessonController] generateLessonAudio error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/lessons/:id/audio
   * Retrieve audio narration metadata and waveform data
   */
  async getLessonAudio(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);
      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const audioAsset = await audioRepository.findByEntity('LESSON', id);

      return ApiResponse.success(res, 200, 'Lesson audio metadata retrieved', {
        lessonId: id,
        audioUrl: audioAsset?.audioUrl || lesson.audioUrl,
        audioPublicId: audioAsset?.audioPublicId || lesson.audioPublicId,
        durationSeconds: audioAsset?.durationSeconds || lesson.audioDurationSeconds,
        waveformUrl: audioAsset?.waveformUrl || lesson.waveformUrl,
        ttsEngine: audioAsset?.ttsEngine || 'PIPER_TTS',
        voiceId: audioAsset?.voiceId || 'en_US-lessac-medium'
      });
    } catch (error) {
      logger.error('[LessonController] getLessonAudio error:', error.message);
      next(error);
    }
  }

  /**
   * GET /api/lessons/:id/mastery
   * Retrieve student mastery across all concepts in the lesson
   */
  async getLessonMastery(req, res, next) {
    try {
      const { id } = req.params;
      const lesson = await lessonRepository.findById(id);
      if (!lesson) {
        throw new NotFoundError(`Lesson with ID "${id}" not found.`, { id });
      }

      const userMasteryList = await masteryRepository.findAllByUserId(req.user.id);
      const questions = await questionRepository.findByLessonId(id);
      const lessonConceptIds = [...new Set(questions.map(q => q.conceptId).filter(Boolean))];

      const conceptMastery = userMasteryList.filter(m => lessonConceptIds.includes(m.conceptId));
      const avgScore = conceptMastery.length > 0
        ? Math.round(conceptMastery.reduce((acc, m) => acc + m.masteryScore, 0) / conceptMastery.length)
        : 0;

      return ApiResponse.success(res, 200, 'Lesson mastery summary retrieved', {
        lessonId: id,
        overallMasteryScore: avgScore,
        conceptsTracked: conceptMastery.length,
        conceptMastery
      });
    } catch (error) {
      logger.error('[LessonController] getLessonMastery error:', error.message);
      next(error);
    }
  }
}

const lessonController = new LessonController();
module.exports = lessonController;
