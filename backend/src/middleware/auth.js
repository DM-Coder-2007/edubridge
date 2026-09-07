/**
 * EduBridge Adaptive - JWT Authentication Middleware
 */

const JwtUtil = require('../utils/jwt');
const ApiResponse = require('../utils/apiResponse');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

async function authenticate(req, res, next) {
  try {
    let token = null;
    if (req.cookies && (req.cookies.token || req.cookies.auth_token)) {
      token = req.cookies.token || req.cookies.auth_token;
    } else if (req.signedCookies && (req.signedCookies.token || req.signedCookies.auth_token)) {
      token = req.signedCookies.token || req.signedCookies.auth_token;
    } else {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }
    }

    if (!token) {
      return ApiResponse.error(res, 401, 'Authentication token is missing or malformed', 'UNAUTHORIZED');
    }
    let decoded;
    try {
      decoded = JwtUtil.verifyToken(token);
    } catch (err) {
      return ApiResponse.error(res, 401, 'Invalid or expired authentication token', 'TOKEN_INVALID', err.message);
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return ApiResponse.error(res, 401, 'User account associated with token no longer exists', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return ApiResponse.error(res, 403, 'User account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      gradeLevel: user.gradeLevel,
      preferredLanguage: user.preferredLanguage,
      accessibilityPreferences: user.accessibilityPreferences
    };

    next();
  } catch (error) {
    logger.error('[AuthMiddleware] Authentication error:', error);
    return ApiResponse.error(res, 500, 'Authentication error', 'INTERNAL_AUTH_ERROR');
  }
}

module.exports = authenticate;
