/**
 * EduBridge Adaptive - Async Route Handler Wrapper
 * Catches unhandled promise rejections and forwards them to the centralized error middleware.
 *
 * @param {Function} fn - Async Express middleware/controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
