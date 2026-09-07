/**
 * EduBridge Adaptive - Question & Answer Controller
 *
 * Handles HTTP requests for:
 * - GET  /api/questions/:id (get question details)
 * - POST /api/questions/:id/answer (submit text or voice answer, evaluate via Gemini, update Snowflake mastery)
 *
 * Architecture: Controller -> Service -> Repository -> Snowflake
 */

const questionRepository = require('../repositories/question.repository');
const attemptRepository = require('../repositories/attempt.repository');
const masteryRepository = require('../repositories/mastery.repository');
const gemini = require('../integrations/gemini');
const { transcriptionService } = require('../integrations/speech');
const { recommendationService } = require('../services/adaptive');
const ApiResponse = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class QuestionController {
  /**
   * GET /api/questions/:id
   * Retrieve question details by ID
   */
  async getQuestionById(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Question ID parameter is required.', { field: 'id' });
      }

      const question = await questionRepository.findById(id);
      if (!question) {
        throw new NotFoundError(`Question with ID "${id}" not found.`, { id });
      }

      return ApiResponse.success(res, 200, 'Question retrieved successfully', {
        question
      });
    } catch (error) {
      logger.error('[QuestionController] getQuestionById error:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/questions/:id/answer
   * Submit and evaluate student answer (typed text or faster-whisper voice recording)
   */
  async submitAnswer(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Question ID parameter is required.', { field: 'id' });
      }

      const question = await questionRepository.findById(id);
      if (!question) {
        throw new NotFoundError(`Question with ID "${id}" not found.`, { id });
      }

      let studentAnswer = req.body?.studentAnswer || req.body?.answer || req.body?.userAnswer;
      let voiceTranscript = null;
      let voiceConfidence = null;
      let isVoiceAnswer = false;

      // Check if voice recording was uploaded via multipart/form-data
      let audioBuffer = req.file ? req.file.buffer : null;
      let mimeType = req.file ? req.file.mimetype : null;

      // Also support base64 audio payload in JSON body
      if (!audioBuffer && req.body?.audioBase64) {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
        mimeType = req.body.mimeType || 'audio/wav';
      }

      if (audioBuffer) {
        logger.info(`[QuestionController] Processing voice answer recording for question ${id}, user ${req.user.id}`);
        const voiceResult = await transcriptionService.processVoiceAnswer(audioBuffer, {
          mimeType: mimeType || 'audio/wav',
          language: req.body?.language || 'en',
          userId: req.user.id,
          lessonId: question.lessonId
        });

        voiceTranscript = voiceResult.transcript;
        voiceConfidence = voiceResult.confidence;
        isVoiceAnswer = true;
        studentAnswer = voiceTranscript;
      }

      // Validate student answer exists
      if (!studentAnswer || typeof studentAnswer !== 'string' || studentAnswer.trim().length === 0) {
        throw new ValidationError('A non-empty student answer or audio recording is required.', {
          field: 'studentAnswer'
        });
      }

      studentAnswer = studentAnswer.trim();
      const timeTaken = Math.max(1, parseInt(req.body?.timeTaken || req.body?.timeTakenSeconds || 30, 10));
      const attemptId = req.body?.attemptId || null;

      logger.info(`[QuestionController] Evaluating answer for question ${id} by user ${req.user.id}: "${studentAnswer.substring(0, 40)}..."`);

      // 1. Evaluate with Google Gemini Multimodal AI
      const evalResult = await gemini.evaluateStudentAnswer({
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        studentAnswer,
        conceptName: question.conceptId || 'Core Concept',
        entityId: id
      });

      // 2. Fetch prior concept mastery to inform adaptation
      const conceptId = question.conceptId || `concept_${question.lessonId || 'general'}`;
      const priorMastery = await masteryRepository.findByUserAndConcept(req.user.id, conceptId);

      // 3. Process adaptive learning engine progression
      const adaptiveResult = await recommendationService.processAdaptiveAttempt({
        question,
        concept: { id: conceptId, name: question.conceptId || 'Core Concept' },
        studentAnswer,
        isCorrect: evalResult.isCorrect,
        correctness: evalResult.isCorrect,
        timeTaken,
        previousMastery: priorMastery ? priorMastery.masteryScore : null,
        questionDifficulty: question.difficultyLevel || 'medium',
        userId: req.user.id,
        lessonId: question.lessonId,
        attemptId
      });

      // 4. Record answer in attempt session (auto-create session if not provided)
      let effectiveAttemptId = attemptId;
      if (!effectiveAttemptId) {
        try {
          const newAttempt = await attemptRepository.createAttempt({
            userId: req.user.id,
            lessonId: question.lessonId,
            totalQuestions: 1,
            status: 'COMPLETED'
          });
          effectiveAttemptId = newAttempt.id;
        } catch (cErr) {
          logger.debug(`[QuestionController] Attempt auto-create notice: ${cErr.message}`);
        }
      }

      if (effectiveAttemptId) {
        try {
          await attemptRepository.recordAnswer(effectiveAttemptId, {
            questionId: id,
            studentAnswer,
            isCorrect: evalResult.isCorrect,
            score: evalResult.score,
            timeTakenSeconds: timeTaken,
            transcript: voiceTranscript,
            confidence: voiceConfidence,
            aiFeedback: evalResult.feedback
          });
        } catch (attErr) {
          logger.warn(`[QuestionController] Non-fatal attempt answer record warning: ${attErr.message}`);
        }
      }

      return ApiResponse.success(res, 200, 'Answer evaluated successfully', {
        questionId: id,
        isCorrect: evalResult.isCorrect,
        score: evalResult.score,
        feedback: evalResult.feedback,
        weakConcepts: evalResult.weakConcepts || [],
        recommendedNextDifficulty: evalResult.recommendedNextDifficulty || adaptiveResult.recommendedDifficulty,
        followupQuestion: evalResult.followupQuestion || null,
        isVoiceAnswer,
        voiceTranscript,
        voiceConfidence,
        adaptive: {
          updatedMastery: adaptiveResult.updatedMastery,
          recommendedDifficulty: adaptiveResult.recommendedDifficulty,
          nextQuestion: adaptiveResult.nextQuestion,
          reinforcementRequirement: adaptiveResult.reinforcementRequirement
        }
      });
    } catch (error) {
      logger.error('[QuestionController] submitAnswer error:', error.message);
      next(error);
    }
  }
}

const questionController = new QuestionController();
module.exports = questionController;
