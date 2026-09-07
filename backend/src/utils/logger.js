/**
 * EduBridge Adaptive - Structured Logger with Strict Secret Redaction
 * Ensures zero credential/secret leakage across all log outputs.
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'bearer',
  'private_key',
  'cookie',
  'access_token',
  'refresh_token',
  'jwt'
];

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and strings.
 *
 * @param {*} data - Data to redact
 * @returns {*} Redacted clone of data
 */
function redactSensitive(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***REDACTED***')
      .replace(/(password|secret|token|apiKey|key)=([^&\s]+)/gi, '$1=***REDACTED***');
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitive);
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some(p => lowerKey.includes(p));

      if (isSensitiveKey && (typeof value !== 'object' || value === null)) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = redactSensitive(value);
      } else if (typeof value === 'string') {
        sanitized[key] = redactSensitive(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

function getLogLevel() {
  const envLevel = (process.env.LOG_LEVEL || '').toUpperCase();
  if (LOG_LEVELS[envLevel] !== undefined) return envLevel;
  return process.env.NODE_ENV === 'test' ? 'ERROR' : 'INFO';
}

function formatLog(level, message, meta = null, requestId = null) {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = typeof message === 'string' ? redactSensitive(message) : message;
  const sanitizedMeta = meta !== null ? redactSensitive(meta) : undefined;

  const logObject = {
    timestamp,
    level,
    message: sanitizedMessage,
    ...(requestId ? { requestId } : {}),
    ...(sanitizedMeta !== undefined ? { meta: sanitizedMeta } : {})
  };

  return JSON.stringify(logObject);
}

const logger = {
  redactSensitive,
  redact: redactSensitive,

  error: (message, meta, requestId) => {
    if (LOG_LEVELS[getLogLevel()] >= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, meta, requestId));
    }
  },

  warn: (message, meta, requestId) => {
    if (LOG_LEVELS[getLogLevel()] >= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', message, meta, requestId));
    }
  },

  info: (message, meta, requestId) => {
    if (LOG_LEVELS[getLogLevel()] >= LOG_LEVELS.INFO) {
      console.log(formatLog('INFO', message, meta, requestId));
    }
  },

  debug: (message, meta, requestId) => {
    if (LOG_LEVELS[getLogLevel()] >= LOG_LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', message, meta, requestId));
    }
  }
};

module.exports = logger;
