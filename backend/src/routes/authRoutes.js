/**
 * EduBridge Adaptive - Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegistration, validateLogin, validatePreferences } = require('../validators/authValidators');

router.post('/register', authLimiter, validate(validateRegistration), (req, res, next) => authController.register(req, res, next));
router.post('/login', authLimiter, validate(validateLogin), (req, res, next) => authController.login(req, res, next));
router.get('/profile', authenticate, (req, res, next) => authController.getProfile(req, res, next));
router.put('/preferences', authenticate, validate(validatePreferences), (req, res, next) => authController.updatePreferences(req, res, next));

module.exports = router;
