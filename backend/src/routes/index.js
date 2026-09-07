/**
 * EduBridge Adaptive - Master API Router
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const textbookRoutes = require('./textbookRoutes');
const lessonRoutes = require('./lessonRoutes');
const conceptRoutes = require('./conceptRoutes');
const quizRoutes = require('./quizRoutes');
const progressRoutes = require('./progressRoutes');
const mediaRoutes = require('./mediaRoutes');

const snowflakeDb = require('../database/snowflake');
const mysqlDb = require('../database/mysql');
const config = require('../config');
const ApiResponse = require('../utils/apiResponse');

// Health Check Endpoint
router.get('/health', async (req, res) => {
  let snowflakeHealth = { status: 'unknown' };
  try {
    const sfPing = await snowflakeDb.healthCheck();
    const isOk = sfPing && (sfPing.status === 'OK' || sfPing.success === true);
    snowflakeHealth = {
      status: isOk ? 'connected' : 'error',
      mode: config.snowflake.mockFallback ? 'mock' : 'live',
      database: config.snowflake.database,
      schema: config.snowflake.schema,
      latencyMs: sfPing ? sfPing.latencyMs : null,
      message: sfPing ? (sfPing.message || (isOk ? 'Snowflake operational' : 'Ping failed')) : 'No response'
    };
  } catch (err) {
    snowflakeHealth = { status: 'error', error: err.message };
  }

  let mysqlHealth = { enabled: false, role: 'OPTIONAL_SECONDARY_ADAPTER' };
  if (config.mysql.enabled) {
    try {
      const myPing = await mysqlDb.healthCheck();
      mysqlHealth = {
        enabled: true,
        status: myPing && myPing.status === 'CONNECTED' ? 'connected' : 'error',
        role: 'OPTIONAL_SECONDARY_ADAPTER',
        message: myPing && myPing.error ? myPing.error : 'Connected'
      };
    } catch (err) {
      mysqlHealth = { enabled: true, status: 'error', error: err.message, role: 'OPTIONAL_SECONDARY_ADAPTER' };
    }
  }

  const isHealthy = snowflakeHealth.status === 'connected';

  return ApiResponse.success(
    res,
    isHealthy ? 200 : 503,
    'EduBridge Adaptive API Health Status',
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      services: {
        database: {
          primary: 'Snowflake',
          snowflake: snowflakeHealth,
          secondary: mysqlHealth
        },
        media: {
          provider: 'Cloudinary',
          configured: !config.cloudinary.mockFallback,
          mode: config.cloudinary.mockFallback ? 'mock' : 'live'
        },
        ai: {
          multimodal: 'Google Gemini',
          configured: !config.gemini.mockFallback,
          model: config.gemini.model,
          mode: config.gemini.mockFallback ? 'mock' : 'live'
        },
        tts: {
          engine: 'Piper TTS',
          voice: config.piper.voice,
          mode: config.piper.mockFallback ? 'mock' : (config.piper.httpUrl ? 'sidecar_http' : 'binary_cli')
        },
        speechRecognition: {
          engine: 'faster-whisper',
          configured: !config.whisper.mockFallback,
          mode: config.whisper.mockFallback ? 'mock' : 'http_sidecar'
        }
      }
    }
  );
});

// Mount Resource Sub-Routers
router.use('/auth', authRoutes);
router.use('/textbooks', textbookRoutes);
router.use('/lessons', lessonRoutes);
router.use('/concepts', conceptRoutes);
router.use('/quiz', quizRoutes);
router.use('/progress', progressRoutes);
router.use('/media', mediaRoutes);

module.exports = router;
