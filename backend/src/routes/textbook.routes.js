/**
 * EduBridge Adaptive - Textbook Routes
 *
 * Mandated Endpoints:
 * - POST   /api/textbooks
 * - GET    /api/textbooks
 * - GET    /api/textbooks/:id
 * - DELETE /api/textbooks/:id
 */

const express = require('express');
const router = express.Router();
const textbookController = require('../controllers/textbook.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

// All textbook endpoints require authentication
router.use(authenticate);

router.post('/', upload.single('image'), (req, res, next) => textbookController.uploadTextbook(req, res, next));
router.get('/', (req, res, next) => textbookController.listTextbooks(req, res, next));
router.get('/jobs/:jobId', (req, res, next) => textbookController.getJobStatus(req, res, next));
router.get('/:id/status', (req, res, next) => textbookController.getProcessingStatus(req, res, next));
router.get('/:id', (req, res, next) => textbookController.getTextbookById(req, res, next));
router.delete('/:id', (req, res, next) => textbookController.deleteTextbook(req, res, next));

module.exports = router;
