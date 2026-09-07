/**
 * EduBridge Adaptive - Centralized Error Handling Middleware
 * Intercepts all application errors, malformed JSON, and unexpected exceptions,
 * ensuring no secrets or internal details leak to clients.
 */

const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

function errorMiddleware(err, req, res, _next) {
  const requestId = req.id || req.requestId || 'unknown';

  // 1. Handle malformed JSON body errors from express.json() parser
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    logger.warn(`[${requestId}] Malformed JSON received on ${req.method} ${req.originalUrl}: ${err.message}`, null, requestId);
    return ApiResponse.error(
      res,
      400,
      'Malformed JSON payload in request body',
      'MALFORMED_JSON'
    );
  }

  // 2. Handle CORS disallowed origin errors
  if (err.message && err.message.toLowerCase().includes('cors')) {
    logger.warn(`[${requestId}] Blocked by CORS policy on ${req.method} ${req.originalUrl}: ${err.message}`, null, requestId);
    return ApiResponse.error(
      res,
      403,
      'Not allowed by CORS policy',
      'CORS_ERROR'
    );
  }

  // 3. Resolve status code and error code
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const errorCode = err.errorCode || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected internal server error occurred';

  // 4. Log error securely with secret redaction
  logger.error(
    `[${requestId}] ${req.method} ${req.originalUrl} - ${statusCode} - ${message}`,
    {
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      details: err.details || null
    },
    requestId
  );

  // 5. Build sanitized client response (never leak stack trace in production)
  const isProduction = process.env.NODE_ENV === 'production';
  const details = isProduction ? null : (err.details || null);

  return ApiResponse.error(
    res,
    statusCode,
    message,
    errorCode,
    details
  );
}

module.exports = errorMiddleware;
