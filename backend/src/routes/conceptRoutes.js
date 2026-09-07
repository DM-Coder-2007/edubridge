/**
 * EduBridge Adaptive - Concept Routes
 */

const express = require('express');
const router = express.Router();
const conceptController = require('../controllers/conceptController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/lesson/:lessonId', (req, res, next) => conceptController.getConceptsByLesson(req, res, next));
router.get('/:id', (req, res, next) => conceptController.getConceptById(req, res, next));

module.exports = router;
