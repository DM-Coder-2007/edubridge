/**
 * EduBridge Adaptive - Global Error Handler Middleware
 */

const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  logger.error(`[${req.method}] ${req.originalUrl} - ${statusCode} - ${message}`, {
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    details: err.details || null
  });

  return ApiResponse.error(
    res,
    statusCode,
    message,
    errorCode,
    process.env.NODE_ENV === 'production' ? undefined : err.details || err.stack
  );
}

module.exports = errorHandler;
