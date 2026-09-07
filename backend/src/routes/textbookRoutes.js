/**
 * EduBridge Adaptive - Textbook Routes
 */

const express = require('express');
const router = express.Router();
const textbookController = require('../controllers/textbookController');
const upload = require('../middleware/upload');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { pipelineLimiter } = require('../middleware/rateLimiter');
const { validateScanUpload } = require('../validators/textbookValidators');

router.use(authenticate);

router.post(
  '/process',
  pipelineLimiter,
  upload.single('image'),
  validate(validateScanUpload, 'fileAndBody'),
  (req, res, next) => textbookController.processScan(req, res, next)
);

router.post(
  '/ocr',
  pipelineLimiter,
  upload.single('image'),
  (req, res, next) => textbookController.processOcr(req, res, next)
);

router.get('/', (req, res, next) => textbookController.listUserTextbooks(req, res, next));
router.get('/:id', (req, res, next) => textbookController.getTextbookById(req, res, next));
router.get('/:id/status', (req, res, next) => textbookController.getProcessingStatus(req, res, next));
router.get('/:id/ocr', (req, res, next) => textbookController.getOcrResult(req, res, next));
router.post('/:id/retry-ocr', pipelineLimiter, upload.single('image'), (req, res, next) => textbookController.retryOcr(req, res, next));

module.exports = router;
