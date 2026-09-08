/**
 * EduBridge Adaptive - Central Configuration Module
 */

const dotenv = require('dotenv');
const path = require('path');

const fs = require('fs');

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

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const isDevelopment = env === 'development';
const isTest = env === 'test';

// Production secret guard
const defaultJwtSecret = 'edubridge_default_secret_key_change_in_production';
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultJwtSecret)) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be securely set in production.');
}

const config = {
  env,
  isProduction,
  isDevelopment,
  isTest,
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  auth: {
    jwtSecret: process.env.JWT_SECRET || defaultJwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10)
  },

  // Snowflake - PRIMARY and MANDATORY application database
  snowflake: {
    account: process.env.SNOWFLAKE_ACCOUNT || '',
    username: process.env.SNOWFLAKE_USERNAME || '',
    password: process.env.SNOWFLAKE_PASSWORD || '',
    database: process.env.SNOWFLAKE_DATABASE || 'EDUBRIDGE_ADAPTIVE',
    schema: process.env.SNOWFLAKE_SCHEMA || 'APP',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'edubridge',
    role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN',
    mockFallback: false
  },

  // Cloudinary - MANDATORY media storage and delivery layer
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'edubridge',
    mockFallback: process.env.CLOUDINARY_MOCK_FALLBACK === 'true' || !process.env.CLOUDINARY_CLOUD_NAME
  },

  // Gemini - MANDATORY Multimodal AI API
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    mockFallback: process.env.GEMINI_MOCK_FALLBACK === 'true' || !process.env.GEMINI_API_KEY
  },

  // Piper TTS - MANDATORY Local Neural Text-to-Speech
  piper: {
    voice: process.env.PIPER_VOICE || 'en_US-lessac-medium',
    binPath: process.env.PIPER_BIN_PATH || 'piper',
    modelPath: process.env.PIPER_MODEL_PATH || '',
    httpUrl: process.env.PIPER_HTTP_URL || '',
    speakingRate: parseFloat(process.env.PIPER_SPEAKING_RATE || '1.0'),
    mockFallback: process.env.PIPER_MOCK_FALLBACK === 'true' || (!process.env.PIPER_MODEL_PATH && !process.env.PIPER_HTTP_URL)
  },

  // faster-whisper - Speech Recognition
  whisper: {
    httpUrl: process.env.WHISPER_HTTP_URL || '',
    model: process.env.WHISPER_MODEL || 'base.en',
    mockFallback: process.env.WHISPER_MOCK_FALLBACK === 'true' || !process.env.WHISPER_HTTP_URL
  },

  // MySQL - OPTIONAL secondary compatibility adapter only (never replaces Snowflake)
  mysql: {
    enabled: process.env.MYSQL_ENABLED === 'true',
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'edubridge_secondary'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  }
};

module.exports = config;
