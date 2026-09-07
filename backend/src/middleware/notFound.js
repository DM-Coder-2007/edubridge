/**
 * EduBridge Adaptive - 404 Not Found Middleware
 */

const ApiResponse = require('../utils/apiResponse');

function notFound(req, res, _next) {
  return ApiResponse.error(
    res,
    404,
    `Route not found: [${req.method}] ${req.originalUrl}`,
    'NOT_FOUND'
  );
}

module.exports = notFound;
