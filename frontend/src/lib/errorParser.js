/**
 * EduBridge Adaptive - Centralized API Error Parser
 *
 * Maps technical backend errors, HTTP status codes, and network exceptions
 * into friendly, empathetic, and actionable user messages.
 * Never displays "undefined", "null", or raw stack traces to the student.
 * Keeps technical debugging details in development logs only.
 */

const FRIENDLY_ERROR_MAP = {
  // Network and Connectivity
  NETWORK_ERROR: {
    title: 'Connection Issue',
    message: 'Unable to connect to the EduBridge learning service. Please check your network connection or verify that the server is online.',
    action: 'Retry Connection'
  },
  TIMEOUT: {
    title: 'Request Timed Out',
    message: 'The server took too long to respond. This might happen during heavy AI processing. Please try again.',
    action: 'Try Again'
  },

  // Authentication & Authorization (401 / 403)
  UNAUTHORIZED: {
    title: 'Authentication Required',
    message: 'Your session has expired or you need to sign in to access this page.',
    action: 'Log In'
  },
  INVALID_CREDENTIALS: {
    title: 'Sign In Failed',
    message: 'The email or password you entered is incorrect. Please double-check and try again.',
    action: 'Try Again'
  },
  TOKEN_EXPIRED: {
    title: 'Session Expired',
    message: 'Your login session has expired. Please log in again to continue where you left off.',
    action: 'Log In'
  },
  FORBIDDEN: {
    title: 'Access Restricted',
    message: 'You do not have permission to view or modify this resource.',
    action: 'Go to Dashboard'
  },
  ACCOUNT_INACTIVE: {
    title: 'Account Inactive',
    message: 'Your account is currently disabled. Please contact your educator or system administrator.',
    action: 'Contact Support'
  },

  // Resources Not Found (404)
  NOT_FOUND: {
    title: 'Resource Not Found',
    message: 'We could not find the requested content. It may have been removed, moved, or renamed.',
    action: 'Browse Lessons'
  },
  LESSON_NOT_FOUND: {
    title: 'Lesson Not Found',
    message: 'The lesson you are looking for could not be found or has not been generated yet.',
    action: 'View All Lessons'
  },
  TEXTBOOK_NOT_FOUND: {
    title: 'Textbook Scan Not Found',
    message: 'The requested textbook page could not be located.',
    action: 'Upload Textbook'
  },
  QUESTION_NOT_FOUND: {
    title: 'Question Unavailable',
    message: 'The assessment question could not be loaded.',
    action: 'Retry Assessment'
  },

  // Conflicts and Validation (409 / 400 / 422)
  CONFLICT: {
    title: 'Account Already Exists',
    message: 'An account with this email is already registered. Please sign in instead.',
    action: 'Go to Sign In'
  },
  EMAIL_ALREADY_EXISTS: {
    title: 'Email Already Registered',
    message: 'An account with this email address already exists. Please log in or use a different email.',
    action: 'Sign In'
  },
  VALIDATION_ERROR: {
    title: 'Please Check Your Input',
    message: 'One or more required fields contain invalid data. Please review your entries.',
    action: 'Review Details'
  },

  // Media & Uploads (413 / 415)
  PAYLOAD_TOO_LARGE: {
    title: 'File Exceeds Size Limit',
    message: 'The uploaded file is too large. Textbook image scans must be under 10 MB.',
    action: 'Choose Smaller File'
  },
  FILE_TOO_LARGE: {
    title: 'Image Too Large',
    message: 'Please upload an image file smaller than 10 MB.',
    action: 'Select Different Image'
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: 'Unsupported File Format',
    message: 'Only standard image formats (PNG, JPG, JPEG, and WebP) are supported for textbook scanning.',
    action: 'Select Valid Image'
  },
  INVALID_FILE_TYPE: {
    title: 'Unsupported Image Format',
    message: 'Please select a PNG, JPG, JPEG, or WebP textbook page image.',
    action: 'Choose File'
  },

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: {
    title: 'Too Many Requests',
    message: 'You have submitted too many requests in a short period. For system safety, please pause a moment before retrying.',
    action: 'Wait & Retry'
  },

  // Server & Database (500 / 502 / 503)
  INTERNAL_ERROR: {
    title: 'Server Error',
    message: 'The EduBridge learning system encountered a temporary error. Our engineering team has been notified.',
    action: 'Try Again'
  },
  DATABASE_ERROR: {
    title: 'Database Connection Issue',
    message: 'The platform is momentarily unable to connect to the Snowflake database. Please try again in a few moments.',
    action: 'Retry'
  },
  TTS_SYNTHESIS_ERROR: {
    title: 'Audio Narration Unavailable',
    message: 'The neural voice synthesizer encountered an issue generating audio for this lesson section. You can still use the browser Read-Aloud feature.',
    action: 'Use Read-Aloud'
  },
  OCR_FAILED: {
    title: 'Textbook Analysis Failed',
    message: 'The AI multimodal OCR could not extract clear text from the uploaded page. Please check image clarity and re-upload.',
    action: 'Try Clearer Image'
  }
};

/**
 * Normalizes any error object, HTTP response, or string into structured, user-friendly details.
 *
 * @param {Error|Object|string} error - Raw error
 * @param {Object} [fallbackOverrides] - Optional custom fallback titles/messages
 * @returns {{ title: string, message: string, action: string, code: string, status: number|null }}
 */
export function parseApiError(error, fallbackOverrides = {}) {
  // 1. Handle falsy or empty inputs safely (Never return undefined/null to the UI)
  if (!error) {
    return {
      title: fallbackOverrides.title || 'Notification',
      message: fallbackOverrides.message || 'The operation could not be completed at this time.',
      action: fallbackOverrides.action || 'Try Again',
      code: 'UNKNOWN_ERROR',
      status: null
    };
  }

  // 2. Extract technical properties
  const status = error.status || error.statusCode || error.response?.status || null;
  const rawCode = (error.code || error.errorCode || error.response?.data?.error?.code || '').toUpperCase();
  const rawMessage = error.message || error.response?.data?.message || (typeof error === 'string' ? error : '');
  const details = error.details || error.response?.data?.error?.details || null;

  // Log technical details in development only
  if (process.env.NODE_ENV === 'development') {
    console.debug('[errorParser] Parsing error:', { rawCode, status, rawMessage, details });
  }

  // 3. Inspect validation details object to extract field-specific error message
  let specificValidationMessage = null;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const firstField = Object.keys(details)[0];
    if (firstField && details[firstField]) {
      specificValidationMessage = String(details[firstField]);
    }
  }

  // 4. Match against known code mapping
  if (rawCode && FRIENDLY_ERROR_MAP[rawCode]) {
    const mapped = FRIENDLY_ERROR_MAP[rawCode];
    return {
      title: fallbackOverrides.title || mapped.title,
      message: specificValidationMessage || fallbackOverrides.message || mapped.message,
      action: fallbackOverrides.action || mapped.action,
      code: rawCode,
      status
    };
  }


  // 4. Match against HTTP status codes
  if (status === 401) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.UNAUTHORIZED.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.UNAUTHORIZED.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.UNAUTHORIZED.action,
      code: 'UNAUTHORIZED',
      status
    };
  }

  if (status === 403) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.FORBIDDEN.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.FORBIDDEN.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.FORBIDDEN.action,
      code: 'FORBIDDEN',
      status
    };
  }

  if (status === 404) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.NOT_FOUND.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.NOT_FOUND.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.NOT_FOUND.action,
      code: 'NOT_FOUND',
      status
    };
  }

  if (status === 409) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.CONFLICT.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.CONFLICT.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.CONFLICT.action,
      code: 'CONFLICT',
      status
    };
  }

  if (status === 413) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.PAYLOAD_TOO_LARGE.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.PAYLOAD_TOO_LARGE.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.PAYLOAD_TOO_LARGE.action,
      code: 'PAYLOAD_TOO_LARGE',
      status
    };
  }

  if (status === 415) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.UNSUPPORTED_MEDIA_TYPE.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.UNSUPPORTED_MEDIA_TYPE.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.UNSUPPORTED_MEDIA_TYPE.action,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status
    };
  }

  if (status === 429) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.RATE_LIMIT_EXCEEDED.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.RATE_LIMIT_EXCEEDED.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.RATE_LIMIT_EXCEEDED.action,
      code: 'RATE_LIMIT_EXCEEDED',
      status
    };
  }

  if (status && status >= 500) {
    return {
      title: fallbackOverrides.title || 'Server Temporarily Unavailable',
      message: fallbackOverrides.message || 'The server encountered an unexpected error. Please try again shortly.',
      action: fallbackOverrides.action || 'Try Again',
      code: 'INTERNAL_SERVER_ERROR',
      status
    };
  }

  // 5. Detect Network/Fetch errors
  const isNetwork =
    rawCode === 'NETWORK_ERROR' ||
    rawCode === 'ECONNREFUSED' ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('network error') ||
    rawMessage.includes('Load failed');

  if (isNetwork) {
    return {
      title: fallbackOverrides.title || FRIENDLY_ERROR_MAP.NETWORK_ERROR.title,
      message: fallbackOverrides.message || FRIENDLY_ERROR_MAP.NETWORK_ERROR.message,
      action: fallbackOverrides.action || FRIENDLY_ERROR_MAP.NETWORK_ERROR.action,
      code: 'NETWORK_ERROR',
      status: status || 0
    };
  }

  // 6. Inspect validation details object
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const firstField = Object.keys(details)[0];
    if (firstField && details[firstField]) {
      return {
        title: fallbackOverrides.title || 'Input Verification Needed',
        message: String(details[firstField]),
        action: fallbackOverrides.action || 'Review Input',
        code: 'VALIDATION_ERROR',
        status: status || 400
      };
    }
  }

  // 7. Defensive Sanitization: Strip internal stack frames, file paths, SQL syntax, Snowflake identifiers, and JS errors
  let cleanMessage = rawMessage;
  const isInternalLeak =
    !cleanMessage ||
    cleanMessage === 'undefined' ||
    cleanMessage === 'null' ||
    cleanMessage === '[object Object]' ||
    cleanMessage.includes('at ') ||
    cleanMessage.includes('node_modules') ||
    cleanMessage.includes('webpack') ||
    /SELECT\s+|FROM\s+|WHERE\s+|INSERT\s+|UPDATE\s+|DELETE\s+|SQL\s+/i.test(cleanMessage) ||
    /Snowflake|database\s+error|query\s+failed|syntax\s+error/i.test(cleanMessage) ||
    /[a-zA-Z]:\\[^ \n\r\t]+|\/(var|home|usr|etc|opt)\/[^ \n\r\t]+/.test(cleanMessage) ||
    /TypeError:|ReferenceError:|RangeError:|SyntaxError:/.test(cleanMessage) ||
    /Bearer\s+|token|private_key|jwt/i.test(cleanMessage);

  if (isInternalLeak) {
    cleanMessage = 'An unexpected condition prevented this action from completing. Please try again.';
  }

  return {
    title: fallbackOverrides.title || 'Notice',
    message: fallbackOverrides.message || cleanMessage,
    action: fallbackOverrides.action || 'Try Again',
    code: rawCode || 'UNKNOWN_ERROR',
    status
  };
}

/**
 * Returns only the friendly string message for quick display.
 */
export function getFriendlyErrorMessage(error, defaultFallback = 'An unexpected error occurred. Please try again.') {
  const parsed = parseApiError(error, { message: defaultFallback });
  return parsed.message;
}

export default parseApiError;
