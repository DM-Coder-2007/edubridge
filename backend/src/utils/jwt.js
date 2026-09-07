/**
 * EduBridge Adaptive - JWT Token Utility
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

const { UnauthorizedError } = require('./errors');

class JwtUtil {
  static getSecret() {
    const secret = process.env.JWT_SECRET || config.auth?.jwtSecret || 'edubridge_default_secret_key_change_in_production';
    return secret;
  }

  static generateToken(payload, options = {}) {
    const secret = JwtUtil.getSecret();
    const expiresIn = options.expiresIn || config.auth?.jwtExpiresIn || '7d';
    return jwt.sign(payload, secret, {
      ...options,
      expiresIn
    });
  }

  static verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Authentication token missing or invalid.', 'MISSING_TOKEN');
    }

    const secret = JwtUtil.getSecret();
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authentication token has expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError(`Invalid authentication token: ${error.message}`, 'INVALID_TOKEN');
    }
  }
}

module.exports = JwtUtil;
