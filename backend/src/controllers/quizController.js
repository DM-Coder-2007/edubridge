/**
 * EduBridge Adaptive - Quiz Controller
 * Supports text responses and voice responses transcribed via faster-whisper.
 */

const quizRepository = require('../repositories/quizRepository');
const progressRepository = require('../repositories/progressRepository');
const gemini = require('../integrations/gemini');
const speechService = require('../services/speechService');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class QuizController {
  async getQuestionsByLesson(req, res, next) {
    try {
      const questions = await quizRepository.findQuestionsByLessonId(req.params.lessonId);
      return ApiResponse.success(res, 200, 'Questions retrieved', { questions });
    } catch (error) {
      next(error);
    }
  }

  async startAttempt(req, res, next) {
    try {
      const { lessonId, totalQuestions } = req.body;

      const attempt = await quizRepository.createAttempt({
        userId: req.user.id,
        lessonId,
        totalQuestions: totalQuestions || 0
      });

      logger.info(`[QuizController] User ${req.user.email} started attempt ${attempt.id} for lesson ${lessonId}`);

      return ApiResponse.success(res, 201, 'Quiz attempt started', { attempt });
    } catch (error) {
      next(error);
    }
  }

  async submitAnswer(req, res, next) {
    try {
      const { attemptId, questionId } = req.body;
      let studentAnswer = req.body.studentAnswer;

      // If student answered by speaking (voice response), transcribe with faster-whisper
      if (req.file) {
        const whisperResult = await speechService.transcribeVoiceAnswer(req.file.buffer);
        studentAnswer = whisperResult.transcript;
        logger.info(`[QuizController] Transcribed student voice answer: "${studentAnswer}"`);
      }

      if (!studentAnswer) {
        return ApiResponse.error(res, 400, 'studentAnswer text or voice audio file is required', 'MISSING_ANSWER');
      }

      const question = await quizRepository.findQuestionById(questionId);
      if (!question) {
        return ApiResponse.error(res, 404, 'Question not found', 'QUESTION_NOT_FOUND');
      }

      // 1. Evaluate with Gemini AI
      const evaluation = await gemini.evaluateAnswer({
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        studentAnswer,
        entityId: attemptId
      });

      // 2. Record answer in Snowflake ANSWERS
      const answer = await quizRepository.recordAnswer({
        attemptId,
        questionId,
        userId: req.user.id,
        userAnswerText: studentAnswer,
        isCorrect: evaluation.isCorrect,
        aiScore: evaluation.score,
        aiFeedback: evaluation.feedback,
        adaptiveFollowupQuestion: evaluation.adaptiveFollowupQuestion
      });

      // 3. Update concept mastery in Snowflake
      let mastery = null;
      if (question.conceptId) {
        mastery = await progressRepository.updateMastery({
          userId: req.user.id,
          conceptId: question.conceptId,
          isCorrect: evaluation.isCorrect
        });
      }

      logger.info(`[QuizController] Answer evaluated for question ${questionId}: correct=${evaluation.isCorrect}, score=${evaluation.score}`);

      return ApiResponse.success(res, 200, 'Answer evaluated successfully', {
        answer,
        evaluation,
        conceptMastery: mastery
      });
    } catch (error) {
      logger.error('[QuizController] Error submitting answer:', error);
      next(error);
    }
  }

  async completeAttempt(req, res, next) {
    try {
      const { attemptId, timeSpentSeconds } = req.body;

      const answers = await quizRepository.findAnswersByAttemptId(attemptId);
      const totalCount = answers.length;
      const correctCount = answers.filter(a => a.isCorrect).length;
      const scorePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      const updatedAttempt = await quizRepository.updateAttemptScore(attemptId, {
        correctQuestions: correctCount,
        totalQuestions: totalCount,
        scorePercentage: scorePct,
        timeSpentSeconds: timeSpentSeconds || 60
      });

      await progressRepository.upsertProgress({
        userId: req.user.id,
        lessonId: updatedAttempt.lessonId,
        status: scorePct >= 70 ? 'COMPLETED' : 'IN_PROGRESS',
        completionPercentage: scorePct
      });

      logger.info(`[QuizController] Attempt ${attemptId} completed. Score: ${scorePct}% (${correctCount}/${totalCount})`);

      return ApiResponse.success(res, 200, 'Attempt completed successfully', {
        attempt: updatedAttempt,
        totalQuestions: totalCount,
        correctQuestions: correctCount,
        scorePercentage: scorePct
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QuizController();
