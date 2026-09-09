/**
 * EduBridge Adaptive - Authentication Controller
 *
 * Handles HTTP requests for:
 * - POST /api/auth/signup (user registration, bcrypt hash, HttpOnly cookie)
 * - POST /api/auth/login (credential check, HttpOnly cookie)
 * - POST /api/auth/logout (clears HttpOnly cookie)
 * - GET /api/auth/me (authenticated user profile retrieval)
 *
 * CRITICAL ARCHITECTURE RULES:
 * - Passwords never returned or stored in plain text.
 * - JWT delivered via HttpOnly cookies (never unnecessarily returned in response bodies).
 * - User identity strictly comes from verified authentication context.
 */

const authService = require('../services/auth');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const COOKIE_NAME = 'token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns security-hardened HttpOnly cookie options
 */
function getCookieOptions(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecure = isProduction || Boolean(req?.secure) || req?.headers?.['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true, // Prevents client-side scripts from accessing JWT (XSS protection)
    secure: isSecure, // Ensures cookie is only transmitted over HTTPS
    sameSite: isSecure ? 'none' : 'lax', // 'none' allows cross-site cookies over HTTPS (Cloudflare to Render)
    maxAge: SEVEN_DAYS_MS,
    path: '/'
  };
}

class AuthController {
  /**
   * POST /api/auth/signup
   * Register a new user account
   */
  async signup(req, res, next) {
    try {
      const {
        email,
        password,
        fullName,
        role,
        gradeLevel,
        preferredLanguage,
        accessibilityPreferences
      } = req.body;

      const { user, token } = await authService.signup({
        email,
        password,
        fullName,
        role,
        gradeLevel,
        preferredLanguage,
        accessibilityPreferences
      });

      // Deliver JWT securely via HttpOnly cookie
      res.cookie(COOKIE_NAME, token, getCookieOptions(req));

      logger.info(`[AuthController] Signup successful for ${user.email} (${user.id})`);

      // Return authenticated user profile and token for resilient cross-origin client authorization
      return ApiResponse.success(res, 201, 'User registered successfully', {
        user,
        token
      });
    } catch (error) {
      logger.error('[AuthController] Signup failed:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Authenticate existing user credentials
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const { user, token } = await authService.login({ email, password });

      // Deliver JWT securely via HttpOnly cookie
      res.cookie(COOKIE_NAME, token, getCookieOptions(req));

      logger.info(`[AuthController] Login successful for ${user.email} (${user.id})`);

      // Return authenticated user profile and token for resilient cross-origin client authorization
      return ApiResponse.success(res, 200, 'Login successful', {
        user,
        token
      });
    } catch (error) {
      logger.error('[AuthController] Login failed:', error.message);
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Invalidate session by clearing HttpOnly authentication cookie
   */
  async logout(req, res, next) {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const isSecure = isProduction || Boolean(req?.secure) || req?.headers?.['x-forwarded-proto'] === 'https';
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        path: '/'
      });

      logger.info(`[AuthController] User logged out (IP: ${req.ip})`);

      return ApiResponse.success(res, 200, 'Logout successful');
    } catch (error) {
      logger.error('[AuthController] Logout error:', error);
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get authenticated user profile from verified context
   */
  async getMe(req, res, next) {
    try {
      // User ID strictly retrieved from verified authentication context
      const userId = req.user.id;
      const currentUser = await authService.getCurrentUser(userId);

      return ApiResponse.success(res, 200, 'Current user profile retrieved', {
        user: currentUser
      });
    } catch (error) {
      logger.error('[AuthController] getMe error:', error);
      next(error);
    }
  }

  /**
   * PUT /api/auth/preferences
   * Update accessibility preferences for authenticated user
   */
  async updatePreferences(req, res, next) {
    try {
      const preferences = req.body.preferences || req.body;
      const updatedUser = await authService.updatePreferences(req.user.id, preferences);

      logger.info(`[AuthController] Updated preferences for user ${req.user.id}`);

      return ApiResponse.success(res, 200, 'Accessibility preferences updated', {
        user: updatedUser,
        preferences: updatedUser.accessibilityPreferences
      });
    } catch (error) {
      logger.error('[AuthController] updatePreferences error:', error);
      next(error);
    }
  }
}


const authController = new AuthController();
module.exports = authController;
