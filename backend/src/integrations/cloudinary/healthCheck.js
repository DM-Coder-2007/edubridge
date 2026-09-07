/**
 * EduBridge Adaptive - Cloudinary Health Check
 *
 * Verifies connectivity, responsiveness, and configuration integrity.
 * SECURITY: Never exposes CLOUDINARY_API_SECRET.
 */

const client = require('./client');
const logger = require('../../utils/logger');

class CloudinaryHealthCheck {
  /**
   * Diagnostic check for Cloudinary connectivity and configuration
   * @returns {Promise<object>} Diagnostic report
   */
  async checkHealth() {
    const pingResult = await client.ping();
    const isHealthy = pingResult.connected;

    const report = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: pingResult.connected,
      mode: pingResult.mode,
      cloudName: client.getCloudName(),
      baseFolder: client.getBaseFolder(),
      latencyMs: pingResult.latencyMs
    };

    if (pingResult.error) {
      report.error = pingResult.error;
    }

    if (!isHealthy) {
      logger.warn('[CloudinaryHealth] Health check reported unhealthy status:', report);
    }

    return report;
  }
}

const healthCheck = new CloudinaryHealthCheck();
module.exports = healthCheck;
