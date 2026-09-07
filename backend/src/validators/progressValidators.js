/**
 * EduBridge Adaptive - Progress Request Validators
 */

const { ValidationError } = require('../utils/errors');

function validateProgressUpdate(lessonId, body) {
  if (!lessonId) {
    throw new ValidationError('lessonId path parameter is required');
  }

  const { completionPercentage, lastAudioPositionSeconds } = body || {};

  if (completionPercentage !== undefined) {
    const pct = parseFloat(completionPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new ValidationError('completionPercentage must be a number between 0 and 100');
    }
  }

  if (lastAudioPositionSeconds !== undefined) {
    const pos = parseFloat(lastAudioPositionSeconds);
    if (isNaN(pos) || pos < 0) {
      throw new ValidationError('lastAudioPositionSeconds must be a positive number');
    }
  }
}

module.exports = {
  validateProgressUpdate
};
