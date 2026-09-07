/**
 * EduBridge Adaptive - Performance Logger Middleware
 * 
 * Logs request execution metrics with [PERF] tag:
 * - HTTP Method & URL Path
 * - Execution Duration (ms)
 * - HTTP Status Code
 * - Timestamp
 */

const logger = require('../utils/logger');

module.exports = function perfLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log performance metrics for API requests
    if (originalUrl.startsWith('/api') || originalUrl.startsWith('/health')) {
      logger.info(`[PERF] ${method} ${originalUrl} -> ${statusCode} in ${duration}ms [${new Date().toISOString()}]`);
    }
  });

  next();
};
