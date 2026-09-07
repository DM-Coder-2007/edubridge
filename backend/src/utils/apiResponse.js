/**
 * EduBridge Adaptive - Standardized API Response Helper
 * Enforces consistent JSON API responses across all endpoints.
 */

class ApiResponse {
  /**
   * Format and send a successful JSON response
   * @param {object} res - Express response object
   * @param {number} [statusCode=200] - HTTP status code
   * @param {string} [message='Success'] - Response message
   * @param {*} [data=null] - Payload data
   * @param {object} [meta] - Optional metadata (pagination, etc.)
   */
  static success(res, statusCode = 200, message = 'Success', data = null, meta = undefined) {
    const payload = {
      success: true,
      message,
      data
    };
    if (meta !== undefined) {
      payload.meta = meta;
    }
    return res.status(statusCode).json(payload);
  }

  /**
   * Format and send an error JSON response
   * @param {object} res - Express response object
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [message='Internal Server Error'] - User-friendly error message
   * @param {string} [errorCode='INTERNAL_ERROR'] - Machine-readable error code
   * @param {*} [details=null] - Specific error details (validation errors, etc.)
   */
  static error(res, statusCode = 500, message = 'Internal Server Error', errorCode = 'INTERNAL_ERROR', details = null) {
    const payload = {
      success: false,
      message,
      error: {
        code: errorCode,
        details: details || null
      }
    };
    return res.status(statusCode).json(payload);
  }

  /**
   * Send a direct JSON response while ensuring status code is set
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {object} json - JSON object
   */
  static send(res, statusCode, json) {
    return res.status(statusCode).json(json);
  }
}

module.exports = ApiResponse;
