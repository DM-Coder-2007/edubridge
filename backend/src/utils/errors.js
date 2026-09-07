/**
 * EduBridge Adaptive - Typed Custom Application Errors
 */

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', errorCodeOrDetails = 'UNAUTHORIZED', details = null) {
    const isErrorCode = typeof errorCodeOrDetails === 'string' && (errorCodeOrDetails === errorCodeOrDetails.toUpperCase() || errorCodeOrDetails.includes('_'));
    const errorCode = isErrorCode ? errorCodeOrDetails : 'UNAUTHORIZED';
    const finalDetails = isErrorCode ? details : errorCodeOrDetails;
    super(message, 401, errorCode, finalDetails);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', errorCodeOrDetails = 'FORBIDDEN', details = null) {
    const isErrorCode = typeof errorCodeOrDetails === 'string' && (errorCodeOrDetails === errorCodeOrDetails.toUpperCase() || errorCodeOrDetails.includes('_'));
    const errorCode = isErrorCode ? errorCodeOrDetails : 'FORBIDDEN';
    const finalDetails = isErrorCode ? details : errorCodeOrDetails;
    super(message, 403, errorCode, finalDetails);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class ImageRetrievalError extends AppError {
  constructor(message = 'Failed to retrieve image from Cloudinary', details = null) {
    super(message, 400, 'IMAGE_RETRIEVAL_FAILED', details);
  }
}

class ImageQualityError extends AppError {
  constructor(message = 'Image quality or resolution is insufficient for OCR', details = null) {
    super(message, 400, 'IMAGE_QUALITY_INSUFFICIENT', details);
  }
}

class AiAnalysisError extends AppError {
  constructor(message = 'AI image content analysis failed', details = null) {
    super(message, 500, 'AI_ANALYSIS_FAILED', details);
  }
}

class AiServiceUnavailableError extends AppError {
  constructor(message = 'AI service is currently unavailable', details = null) {
    super(message, 503, 'AI_SERVICE_UNAVAILABLE', details);
  }
}

class AiOutputInvalidError extends AppError {
  constructor(message = 'AI generated output failed schema validation', details = null) {
    super(message, 422, 'AI_OUTPUT_INVALID', details);
  }
}

class GroundingFailedError extends AppError {
  constructor(message = 'Lesson grounding validation score below threshold', details = null) {
    super(message, 422, 'GROUNDING_FAILED', details);
  }
}

class TtsServiceUnavailableError extends AppError {
  constructor(message = 'TTS speech service is currently unavailable', details = null) {
    super(message, 503, 'TTS_SERVICE_UNAVAILABLE', details);
  }
}

class AudioUploadError extends AppError {
  constructor(message = 'Audio upload to media storage failed', details = null) {
    super(message, 503, 'AUDIO_UPLOAD_FAILED', details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ImageRetrievalError,
  ImageQualityError,
  AiAnalysisError,
  AiServiceUnavailableError,
  AiOutputInvalidError,
  GroundingFailedError,
  TtsServiceUnavailableError,
  AudioUploadError
};
