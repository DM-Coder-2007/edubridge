/**
 * EduBridge Adaptive - Lesson Routes
 */

const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res, next) => lessonController.listUserLessons(req, res, next));
router.get('/:id', (req, res, next) => lessonController.getLessonById(req, res, next));
router.post('/:id/regenerate-audio', (req, res, next) => lessonController.regenerateAudio(req, res, next));

module.exports = router;
