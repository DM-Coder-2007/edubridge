/**
 * EduBridge Adaptive - Lesson Routes
 *
 * Mandated Endpoints:
 * - GET  /api/lessons/:id
 * - POST /api/lessons/:id/generate
 * - POST /api/lessons/:id/regenerate
 * - GET  /api/lessons/:id/questions
 * - POST /api/lessons/:id/audio
 * - GET  /api/lessons/:id/audio
 * - GET  /api/lessons/:id/mastery
 */

const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lesson.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All lesson routes require authentication
router.use(authenticate);

// Lesson Retrieval & Generation
router.get('/', (req, res, next) => lessonController.listLessons(req, res, next));
router.get('/:id', (req, res, next) => lessonController.getLessonById(req, res, next));
router.post('/:id/generate', (req, res, next) => lessonController.generateLesson(req, res, next));
router.post('/:id/regenerate', (req, res, next) => lessonController.regenerateLesson(req, res, next));

// Lesson Questions
router.get('/:id/questions', (req, res, next) => lessonController.getLessonQuestions(req, res, next));

// Lesson Audio & Narration (Piper TTS + Cloudinary)
router.post('/:id/audio', (req, res, next) => lessonController.generateLessonAudio(req, res, next));
router.get('/:id/audio', (req, res, next) => lessonController.getLessonAudio(req, res, next));

// Lesson Mastery
router.get('/:id/mastery', (req, res, next) => lessonController.getLessonMastery(req, res, next));

module.exports = router;
