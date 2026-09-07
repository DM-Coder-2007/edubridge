/**
 * EduBridge Adaptive - Authentication Request Validators
 */

const { ValidationError } = require('../utils/errors');

function validateRegistration(data) {
  const { email, password, fullName } = data || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new ValidationError('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    throw new ValidationError('Full name is required');
  }
}

function validateLogin(data) {
  const { email, password } = data || {};

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }
}

function validatePreferences(data) {
  const prefs = (data && data.preferences) ? data.preferences : data;

  if (!prefs || typeof prefs !== 'object' || Object.keys(prefs).length === 0) {
    throw new ValidationError('Preferences object is required');
  }
}

module.exports = {
  validateRegistration,
  validateLogin,
  validatePreferences
};
