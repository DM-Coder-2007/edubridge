/**
 * EduBridge Adaptive - Authentication & Authorization Middleware
 *
 * Implements:
 * - Token extraction from HttpOnly cookies and Bearer headers
 * - Cryptographic verification against environment JWT secret
 * - Snowflake user validation and context population (req.user, req.userId)
 * - Strict role-based authorization (authorize)
 * - User isolation enforcement (never trusts user_id from frontend payload)
 */

const authService = require('../services/auth');
const ApiResponse = require('../utils/apiResponse');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Extract JWT from request cookies or Authorization header
 * @param {object} req - Express request
 * @returns {string|null}
 */
function extractToken(req) {
  // 1. Primary: HttpOnly cookie
  if (req.cookies && (req.cookies.token || req.cookies.auth_token)) {
    return req.cookies.token || req.cookies.auth_token;
  }

  // 2. Signed cookies
  if (req.signedCookies && (req.signedCookies.token || req.signedCookies.auth_token)) {
    return req.signedCookies.token || req.signedCookies.auth_token;
  }

  // 3. Fallback: Authorization: Bearer <token>
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Authenticate incoming request
 * Verifies JWT and injects verified user into req.user & req.userId
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      logger.warn(`[AuthMiddleware] Missing token on protected route: ${req.method} ${req.originalUrl}`);
      return ApiResponse.error(
        res,
        401,
        'Authentication required. Please log in.',
        'MISSING_TOKEN'
      );
    }

    // Verify cryptographic signature and expiration
    let decoded;
    try {
      decoded = authService.verifyToken(token);
    } catch (err) {
      logger.warn(`[AuthMiddleware] Token verification failed: ${err.message}`);
      const statusCode = err.statusCode || 401;
      const errorCode = err.errorCode || 'INVALID_TOKEN';
      return ApiResponse.error(res, statusCode, err.message, errorCode);
    }

    if (!decoded || !decoded.id) {
      return ApiResponse.error(
        res,
        401,
        'Invalid authentication token payload.',
        'INVALID_TOKEN'
      );
    }

    // Verify user exists and is active in Snowflake
    let currentUser;
    try {
      currentUser = await authService.getCurrentUser(decoded.id);
    } catch (err) {
      logger.warn(`[AuthMiddleware] User lookup failed for ID ${decoded.id}: ${err.message}`);
      const statusCode = err.statusCode || 401;
      const errorCode = err.errorCode || 'UNAUTHORIZED';
      return ApiResponse.error(res, statusCode, err.message, errorCode);
    }

    // Populate verified authentication context
    req.user = currentUser;
    req.userId = currentUser.id;

    // CRITICAL SECURITY RULE: Never trust user_id supplied by the frontend!
    // If the frontend sent a user_id or userId in the body, verify or strictly override it
    if (req.body && typeof req.body === 'object') {
      if (req.body.userId && req.body.userId !== currentUser.id) {
        logger.warn(
          `[AuthMiddleware] Spoofing attempt blocked: req.body.userId=${req.body.userId} overridden by authenticated=${currentUser.id}`
        );
      }
      if (req.body.user_id && req.body.user_id !== currentUser.id) {
        logger.warn(
          `[AuthMiddleware] Spoofing attempt blocked: req.body.user_id=${req.body.user_id} overridden by authenticated=${currentUser.id}`
        );
      }
      // Ensure backend uses canonical authenticated user ID
      req.body.userId = currentUser.id;
      req.body.user_id = currentUser.id;
    }

    next();
  } catch (error) {
    logger.error('[AuthMiddleware] Unexpected authentication error:', error);
    next(error);
  }
}

/**
 * Role-based access control authorization middleware
 * @param {...string} allowedRoles - e.g. 'admin', 'teacher'
 */
function authorize(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(
        res,
        401,
        'Authentication required.',
        'UNAUTHORIZED'
      );
    }

    const userRole = (req.user.role || '').toLowerCase().trim();
    if (!normalizedAllowed.includes(userRole)) {
      logger.warn(
        `[AuthMiddleware] Forbidden: User ${req.user.id} (${userRole}) attempted accessing route requiring [${normalizedAllowed.join(', ')}]`
      );
      return ApiResponse.error(
        res,
        403,
        'Access denied: You do not have permission to perform this action.',
        'FORBIDDEN'
      );
    }

    next();
  };
}

/**
 * User isolation middleware
 * Ensures client cannot manipulate another user's resources.
 *
 * @param {Function|string} [targetUserIdGetter='userId'] - Param name or custom getter
 */
function enforceUserIsolation(targetUserIdGetter = 'userId') {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return ApiResponse.error(res, 401, 'Authentication required.', 'UNAUTHORIZED');
    }

    let targetId = null;
    if (typeof targetUserIdGetter === 'function') {
      targetId = targetUserIdGetter(req);
    } else if (typeof targetUserIdGetter === 'string') {
      targetId = req.params[targetUserIdGetter] ||
                 req.query[targetUserIdGetter] ||
                 req.headers[`x-${targetUserIdGetter.toLowerCase()}`];
    }

    if (targetId && String(targetId) !== String(req.user.id)) {
      logger.warn(
        `[AuthMiddleware] User isolation violation: Authenticated ${req.user.id} tried to access resource of ${targetId}`
      );
      return ApiResponse.error(
        res,
        403,
        'Access denied: You cannot access or modify resources belonging to another user.',
        'USER_ISOLATION_VIOLATION'
      );
    }

    next();
  };
}

/**
 * Optional authentication: populates req.user if valid token provided, but doesn't block if missing
 */
async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      req.userId = null;
      return next();
    }

    const decoded = authService.verifyToken(token);
    if (decoded && decoded.id) {
      const user = await authService.getCurrentUser(decoded.id);
      req.user = user;
      req.userId = user.id;
    }
  } catch (_e) {
    req.user = null;
    req.userId = null;
  }
  next();
}

module.exports = {
  authenticate,
  authorize,
  enforceUserIsolation,
  optionalAuth,
  extractToken
};
