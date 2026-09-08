/**
 * EduBridge Adaptive - Health Routes
 *
 * Mandated Endpoints:
 * - GET /api/health
 * - GET /api/health/database
 * - GET /api/health/cloudinary
 * - GET /api/health/ai
 * - GET /api/health/tts
 * - GET /api/health/speech
 */

const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/apiResponse');
const { config } = require('../config/env');
const snowflakeClient = require('../config/snowflake');
const { checkMySQLHealth } = require('../database/mysql/healthCheck');
const { checkCloudinaryHealth } = require('../integrations/cloudinary');
const gemini = require('../integrations/gemini');
const { checkPiperHealth } = require('../integrations/tts');
const { checkSpeechHealth } = require('../integrations/speech');

/**
 * GET /api/health
 * Returns core service operational health status.
 * Preserves strict response schema required by foundation verification tests.
 */
router.get('/', (req, res) => {
  return ApiResponse.send(res, 200, {
    success: true,
    service: config.serviceName || 'edubridge-backend',
    status: 'healthy'
  });
});

/**
 * GET /api/health/database
 * Checks Snowflake (Primary) and secondary database health.
 */
router.get('/database', async (req, res) => {
  try {
    const snowflakePing = await snowflakeClient.ping();
    const mysqlStatus = await checkMySQLHealth();

    const isHealthy = snowflakePing && (snowflakePing.status === 'OK' || snowflakePing.available === true || snowflakePing.connected === true);

    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'snowflake',
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'EDUBRIDGE_ADAPTIVE',
      schema: 'APP',
      message: 'Database health check',
      data: {
        service: 'snowflake',
        status: isHealthy ? 'healthy' : 'degraded',
        database: 'EDUBRIDGE_ADAPTIVE',
        schema: 'APP',
        primary: 'Snowflake',
        snowflake: {
          status: isHealthy ? 'healthy' : 'degraded',
          mode: snowflakePing.mode || 'MOCK_EMULATION',
          latencyMs: snowflakePing.latencyMs || 1
        },
        secondary: mysqlStatus
      }
    });
  } catch (err) {
    return ApiResponse.error(res, 503, `Database health check failed: ${err.message}`, 'DATABASE_HEALTH_ERROR');
  }
});

/**
 * GET /api/health/cloudinary
 * Checks Cloudinary media storage and CDN delivery health.
 */
router.get('/cloudinary', async (req, res) => {
  try {
    const health = await checkCloudinaryHealth();
    const isHealthy = Boolean(health && (health.status === 'healthy' || health.connected === true || health.healthy === true));
    return ApiResponse.success(res, isHealthy ? 200 : 503, 'Cloudinary media health check', {
      provider: 'Cloudinary',
      healthy: isHealthy,
      ...health
    });
  } catch (err) {
    return ApiResponse.error(res, 503, `Cloudinary health check failed: ${err.message}`, 'CLOUDINARY_HEALTH_ERROR');
  }
});

/**
 * GET /api/health/ai
 * Checks Google Gemini multimodal AI service availability.
 */
router.get('/ai', async (req, res) => {
  try {
    const ping = await gemini.ping();
    const isHealthy = Boolean(ping && (ping.status === 'OK' || ping.status === 'healthy' || ping.connected === true));
    return ApiResponse.success(res, isHealthy ? 200 : 503, 'Gemini multimodal AI health check', {
      provider: 'Google Gemini',
      status: isHealthy ? 'healthy' : 'degraded',
      model: typeof gemini.getModelName === 'function' ? gemini.getModelName() : 'gemini-3-flash-preview',
      mode: typeof gemini.isMockMode === 'function' && gemini.isMockMode() ? 'MOCK_SIMULATION' : 'LIVE_API',
      latencyMs: ping.latencyMs || 1
    });
  } catch (err) {
    return ApiResponse.error(res, 503, `AI service health check failed: ${err.message}`, 'AI_HEALTH_ERROR');
  }
});

/**
 * GET /api/health/tts
 * Checks Piper local neural text-to-speech engine availability.
 */
router.get('/tts', async (req, res) => {
  try {
    const health = await checkPiperHealth();
    const isHealthy = Boolean(
      health && (health.status === 'healthy' || health.available === true || (health.piper && health.piper.available))
    );
    return ApiResponse.success(res, isHealthy ? 200 : 503, 'Piper TTS health check', {
      ...health,
      engine: 'Piper TTS'
    });
  } catch (err) {
    return ApiResponse.error(res, 503, `TTS service health check failed: ${err.message}`, 'TTS_HEALTH_ERROR');
  }
});

/**
 * GET /api/health/speech
 * Checks faster-whisper local speech recognition engine availability.
 */
router.get('/speech', async (req, res) => {
  try {
    const health = await checkSpeechHealth();
    const isHealthy = Boolean(health && health.available !== false && health.status !== 'ERROR');
    return ApiResponse.success(res, isHealthy ? 200 : 503, 'faster-whisper speech recognition health check', {
      ...health,
      engine: 'faster-whisper'
    });
  } catch (err) {
    return ApiResponse.error(res, 503, `Speech service health check failed: ${err.message}`, 'SPEECH_HEALTH_ERROR');
  }
});

module.exports = router;
