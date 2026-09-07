/**
 * EduBridge Adaptive - Quiz Routes
 */

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { validateStartQuiz, validateSubmitAnswer, validateCompleteQuiz } = require('../validators/quizValidators');

router.use(authenticate);

router.get('/lesson/:lessonId', (req, res, next) => quizController.getQuestionsByLesson(req, res, next));
router.post('/start', validate(validateStartQuiz), (req, res, next) => quizController.startAttempt(req, res, next));

// Submit answer accepts JSON body or multipart/form-data with an audio file (transcribed via faster-whisper)
const handleVoiceUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

router.post(
  '/submit-answer',
  handleVoiceUpload,
  validate(validateSubmitAnswer, 'fileAndBody'),
  (req, res, next) => quizController.submitAnswer(req, res, next)
);

router.post('/complete', validate(validateCompleteQuiz), (req, res, next) => quizController.completeAttempt(req, res, next));

module.exports = router;
