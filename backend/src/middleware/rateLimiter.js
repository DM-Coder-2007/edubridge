/**
 * EduBridge Adaptive - Rate Limiting Middleware
 * Uses express-rate-limit to protect auth endpoints and intensive AI/media processing.
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/apiResponse');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, 429, 'Too many login attempts. Please try again after 15 minutes.', 'RATE_LIMITED');
  }
});

const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 scans per minute per client
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, 429, 'Processing limit exceeded. Please wait before processing another textbook scan.', 'RATE_LIMITED');
  }
});

module.exports = {
  authLimiter,
  pipelineLimiter
};
