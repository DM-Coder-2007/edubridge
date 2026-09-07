/**
 * EduBridge Adaptive - Password Hashing Utility
 */

const bcrypt = require('bcryptjs');
const config = require('../config');

class PasswordUtil {
  static async hash(plainPassword) {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a valid non-empty string');
    }
    const salt = await bcrypt.genSalt(config.auth.saltRounds);
    return bcrypt.hash(plainPassword, salt);
  }

  static async compare(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

PasswordUtil.hashPassword = PasswordUtil.hash;
PasswordUtil.comparePassword = PasswordUtil.compare;

module.exports = PasswordUtil;
