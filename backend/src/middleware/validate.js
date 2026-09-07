/**
 * EduBridge Adaptive - Request Validator Middleware Wrapper
 */

const ApiResponse = require('../utils/apiResponse');

function validate(validatorFn, source = 'body') {
  return (req, res, next) => {
    try {
      if (source === 'fileAndBody') {
        validatorFn(req.file, req.body);
      } else if (source === 'paramsAndBody') {
        validatorFn(req.params.lessonId, req.body);
      } else {
        validatorFn(req[source]);
      }
      next();
    } catch (err) {
      return ApiResponse.error(res, 400, err.message, 'VALIDATION_ERROR', err.details || null);
    }
  };
}

module.exports = validate;
