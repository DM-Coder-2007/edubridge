/**
 * EduBridge Adaptive - Authentication Controller
 */

const userRepository = require('../repositories/userRepository');
const PasswordUtil = require('../utils/password');
const JwtUtil = require('../utils/jwt');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, fullName, role, gradeLevel, preferredLanguage, accessibilityPreferences } = req.body;

      const existing = await userRepository.findByEmail(email);
      if (existing) {
        return ApiResponse.error(res, 409, 'An account with this email already exists', 'USER_ALREADY_EXISTS');
      }

      const passwordHash = await PasswordUtil.hash(password);

      const defaultAccessibility = {
        screenReader: true,
        voiceSpeed: 1.0,
        highContrast: false,
        pitch: 0.0,
        audioCues: true,
        ...(accessibilityPreferences || {})
      };

      const user = await userRepository.create({
        email,
        passwordHash,
        fullName,
        role: role || 'student',
        gradeLevel: gradeLevel || null,
        preferredLanguage: preferredLanguage || 'en',
        accessibilityPreferences: defaultAccessibility
      });

      const token = JwtUtil.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      logger.info(`[Auth] Registered new user: ${user.email} (${user.role}) in Snowflake`);

      const { passwordHash: _, ...safeUser } = user;

      return ApiResponse.success(res, 201, 'User registered successfully', {
        user: safeUser,
        token
      });
    } catch (error) {
      logger.error('[Auth] Registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return ApiResponse.error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        return ApiResponse.error(res, 403, 'Account is inactive. Contact support.', 'ACCOUNT_INACTIVE');
      }

      const isMatch = await PasswordUtil.compare(password, user.passwordHash);
      if (!isMatch) {
        return ApiResponse.error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }

      const token = JwtUtil.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      logger.info(`[Auth] User logged in: ${user.email}`);

      const { passwordHash: _, ...safeUser } = user;

      return ApiResponse.success(res, 200, 'Login successful', {
        user: safeUser,
        token
      });
    } catch (error) {
      logger.error('[Auth] Login error:', error);
      next(error);
    }
  }

  async getProfile(req, res) {
    return ApiResponse.success(res, 200, 'Profile retrieved successfully', {
      user: req.user
    });
  }

  async updatePreferences(req, res, next) {
    try {
      const preferences = req.body.preferences || req.body;

      const merged = {
        ...(req.user.accessibilityPreferences || {}),
        ...preferences
      };

      const updatedUser = await userRepository.updatePreferences(req.user.id, merged);
      const { passwordHash: _, ...safeUser } = updatedUser;

      logger.info(`[Auth] Updated accessibility preferences for user: ${req.user.email}`);

      return ApiResponse.success(res, 200, 'Accessibility preferences updated', {
        user: safeUser
      });
    } catch (error) {
      logger.error('[Auth] Update preferences error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();
