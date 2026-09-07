/**
 * EduBridge Adaptive - Textbook Request Validators
 */

const { ValidationError } = require('../utils/errors');

function validateScanUpload(file, body) {
  if (!file) {
    throw new ValidationError('Textbook image scan is required (JPEG, PNG, WEBP)');
  }

  const { title, subject } = body || {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('Textbook title is required');
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    throw new ValidationError('Subject is required');
  }
}

module.exports = {
  validateScanUpload
};
