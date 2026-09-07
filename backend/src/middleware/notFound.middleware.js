/**
 * EduBridge Adaptive - 404 Not Found Middleware
 * Intercepts unmapped HTTP routes and returns a consistent JSON error response.
 */

const ApiResponse = require('../utils/apiResponse');

function notFoundMiddleware(req, res, _next) {
  return ApiResponse.error(
    res,
    404,
    `Route not found: [${req.method}] ${req.originalUrl}`,
    'NOT_FOUND'
  );
}

module.exports = notFoundMiddleware;
