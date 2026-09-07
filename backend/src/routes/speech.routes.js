/**
 * EduBridge Adaptive - Speech Recognition Routes (faster-whisper)
 *
 * Mandated Endpoints:
 * - POST /api/speech/transcribe
 */

const express = require('express');
const router = express.Router();
const speechController = require('../controllers/speech.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

// Speech endpoints require authentication
router.use(authenticate);

// Transcribe voice recording
router.post('/transcribe', upload.single('audio'), (req, res, next) =>
  speechController.transcribe(req, res, next)
);

module.exports = router;
