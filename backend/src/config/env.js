/**
 * EduBridge Adaptive - Environment Configuration & Safe Validation
 */

const dotenv = require('dotenv');
const path = require('path');

const fs = require('fs');

// Load environment variables from .env file reliably across working directories
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '..', '..', '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const REQUIRED_ENV_VARS = ['NODE_ENV', 'PORT'];
const ALLOWED_ENVIRONMENTS = ['development', 'production', 'test', 'staging'];

/**
 * Validate environment variables safely.
 * Throws an Error with descriptive message if validation fails.
 *
 * @param {object} [env=process.env] - Environment object to validate
 * @returns {object} Validated environment configuration
 */
function validateEnv(env = process.env) {
  const errors = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!env[varName] || String(env[varName]).trim() === '') {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate NODE_ENV
  if (env.NODE_ENV && !ALLOWED_ENVIRONMENTS.includes(env.NODE_ENV)) {
    errors.push(`Invalid NODE_ENV: "${env.NODE_ENV}". Must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }

  // Validate PORT
  if (env.PORT !== undefined) {
    const parsedPort = Number(env.PORT);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      errors.push(`Invalid PORT: "${env.PORT}". Must be an integer between 1 and 65535`);
    }
  }

  // Validate CORS_ORIGIN
  if (env.CORS_ORIGIN !== undefined && String(env.CORS_ORIGIN).trim() === '') {
    errors.push('CORS_ORIGIN cannot be an empty string');
  }

  if (errors.length > 0) {
    const errorMsg = `Environment Configuration Validation Failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(errorMsg);
  }

  const nodeEnv = env.NODE_ENV || 'development';
  const port = parseInt(env.PORT || '5000', 10);
  const corsOrigin = env.CORS_ORIGIN || '*';
  const apiPrefix = env.API_PREFIX || '/api';
  const rateLimitWindowMs = parseInt(env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  const rateLimitMax = parseInt(env.RATE_LIMIT_MAX || '100', 10);
  const serviceName = env.SERVICE_NAME || 'edubridge-backend';
  const logLevel = env.LOG_LEVEL || (nodeEnv === 'test' ? 'error' : 'info');

  return {
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port,
    corsOrigin,
    apiPrefix,
    rateLimit: {
      windowMs: rateLimitWindowMs,
      max: rateLimitMax
    },
    serviceName,
    logLevel
  };
}

// Initial safe parse for exports (using fallback defaults if running without complete .env)
let config;
try {
  config = validateEnv(process.env);
} catch (err) {
  // If in test or development mode, provide safe defaults for initial import
  config = {
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',
    port: parseInt(process.env.PORT || '5000', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    apiPrefix: process.env.API_PREFIX || '/api',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
    },
    serviceName: 'edubridge-backend',
    logLevel: process.env.LOG_LEVEL || 'info',
    _validationError: err.message
  };
}

module.exports = {
  config,
  validateEnv,
  REQUIRED_ENV_VARS,
  ALLOWED_ENVIRONMENTS
};
