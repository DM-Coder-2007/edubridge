/**
 * EduBridge Adaptive - Dashboard Routes
 *
 * Mandated Endpoints:
 * - GET /api/dashboard
 * - GET /api/dashboard/progress
 * - GET /api/dashboard/mastery
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All dashboard endpoints require authentication
router.use(authenticate);

// Main dashboard overview
router.get('/', (req, res, next) => dashboardController.getDashboardSummary(req, res, next));

// Learning & reading progress
router.get('/progress', (req, res, next) => dashboardController.getDashboardProgress(req, res, next));

// Conceptual mastery analytics & reinforcement recommendations
router.get('/mastery', (req, res, next) => dashboardController.getDashboardMastery(req, res, next));

module.exports = router;
