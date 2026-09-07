/**
 * EduBridge Adaptive - Authentication Routes
 *
 * Mandated Endpoints:
 * - POST /api/auth/signup
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - GET /api/auth/me (protected)
 *
 * Authorization & User Isolation Verification Routes:
 * - GET /api/auth/test/teacher-only (role-based access control)
 * - GET /api/auth/test/isolated-student/:userId (user isolation verification)
 * - POST /api/auth/test/mutate-profile (client spoofing protection)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize, enforceUserIsolation } = require('../middleware/auth.middleware');
const ApiResponse = require('../utils/apiResponse');

// Public authentication endpoints
router.post('/signup', (req, res, next) => authController.signup(req, res, next));
router.post('/register', (req, res, next) => authController.signup(req, res, next)); // Alias for backward compatibility
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Protected profile endpoint - requires verified authentication context
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
router.put('/preferences', authenticate, (req, res, next) => authController.updatePreferences(req, res, next));

// Authorization verification: Role-based access control
router.get(
  '/test/teacher-only',
  authenticate,
  authorize('teacher', 'admin'),
  (req, res) => ApiResponse.success(res, 200, 'Teacher portal access granted', { user: req.user })
);

// User isolation verification: Verifies URL parameter against verified token context
router.get(
  '/test/isolated-student/:userId',
  authenticate,
  enforceUserIsolation('userId'),
  (req, res) => ApiResponse.success(res, 200, 'User resource accessed', { accessedUserId: req.params.userId })
);

// Frontend spoofing protection: Verifies body userId is safely overridden by req.userId
router.post(
  '/test/mutate-profile',
  authenticate,
  (req, res) => ApiResponse.success(res, 200, 'Profile mutated', {
    authenticatedUserId: req.userId,
    bodyUserId: req.body.userId
  })
);

module.exports = router;
