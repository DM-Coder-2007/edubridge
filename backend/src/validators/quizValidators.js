/**
 * EduBridge Adaptive - Quiz Request Validators
 */

const { ValidationError } = require('../utils/errors');

function validateStartQuiz(body) {
  if (!body || !body.lessonId) {
    throw new ValidationError('lessonId is required');
  }
}

function validateSubmitAnswer(arg1, arg2) {
  let file;
  let body;
  if (arg2 !== undefined) {
    file = arg1;
    body = arg2;
  } else {
    body = arg1;
  }
  const { attemptId, questionId, studentAnswer } = body || {};
  if (!attemptId || !questionId) {
    throw new ValidationError('attemptId and questionId are required');
  }
  if (!studentAnswer && !file) {
    throw new ValidationError('studentAnswer text or voice audio file is required');
  }
}

function validateCompleteQuiz(body) {
  if (!body || !body.attemptId) {
    throw new ValidationError('attemptId is required');
  }
}

module.exports = {
  validateStartQuiz,
  validateSubmitAnswer,
  validateCompleteQuiz
};
