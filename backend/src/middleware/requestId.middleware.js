/**
 * EduBridge Adaptive - Request ID Middleware
 * Assigns or propagates unique request correlation IDs for end-to-end traceability.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to ensure every HTTP request has a unique correlation ID.
 * Attaches ID to req.id and sets 'X-Request-Id' response header.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (incomingId && typeof incomingId === 'string' && incomingId.trim().length > 0)
    ? incomingId.trim()
    : uuidv4();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = requestIdMiddleware;
