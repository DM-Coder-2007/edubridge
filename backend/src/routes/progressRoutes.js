/**
 * EduBridge Adaptive - Progress Routes
 */

const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { validateProgressUpdate } = require('../validators/progressValidators');

router.use(authenticate);

router.get('/', (req, res, next) => progressController.getOverview(req, res, next));
router.get('/mastery', (req, res, next) => progressController.getMastery(req, res, next));
router.put(
  '/lesson/:lessonId',
  validate(validateProgressUpdate, 'paramsAndBody'),
  (req, res, next) => progressController.updateLessonProgress(req, res, next)
);

module.exports = router;
