/**
 * EduBridge Adaptive - Question & Answer Routes
 *
 * Mandated Endpoints:
 * - GET  /api/questions/:id
 * - POST /api/questions/:id/answer
 */

const express = require('express');
const router = express.Router();
const questionController = require('../controllers/question.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

// All question endpoints require authentication
router.use(authenticate);

// Get single question
router.get('/:id', (req, res, next) => questionController.getQuestionById(req, res, next));

// Submit answer (accepts either JSON or multipart/form-data audio for voice answers)
router.post('/:id/answer', upload.single('audio'), (req, res, next) =>
  questionController.submitAnswer(req, res, next)
);

module.exports = router;
