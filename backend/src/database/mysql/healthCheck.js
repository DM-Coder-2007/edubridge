/**
 * EduBridge Adaptive - MySQL Health Check (Optional Secondary Adapter)
 *
 * ARCHITECTURAL STATEMENT:
 * "MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database."
 *
 * Verifies and reports the operational status of MySQL without ever compromising
 * or altering the primary status of the Snowflake database.
 */

const mysqlConnection = require('./connection');
const logger = require('../../utils/logger');

/**
 * Check MySQL health status across both enabled and disabled configurations
 *
 * @param {object} [options={}]
 * @param {boolean} [options.forceCheck=false]
 * @returns {Promise<object>} Health diagnostics
 */
async function checkMySQLHealth(options = {}) {
  const isEnabled = mysqlConnection.isEnabled();

  // 1. DISABLED CONFIGURATION (Default & Recommended State)
  if (!isEnabled && !options.forceCheck) {
    return {
      enabled: false,
      status: 'STANDBY',
      primaryDatabase: 'Snowflake',
      role: 'OPTIONAL_SECONDARY_ADAPTER',
      mandatory: false,
      message: 'MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database.'
    };
  }

  // 2. ENABLED CONFIGURATION (Testing or Optional Secondary Storage)
  const startTime = Date.now();
  try {
    const pool = await mysqlConnection.getPool();
    if (!pool) {
      throw new Error('Connection pool could not be initialized.');
    }

    const [rows] = await pool.query('SELECT 1 AS PING');
    const latencyMs = Date.now() - startTime;

    if (!rows || rows.length === 0 || rows[0].PING !== 1) {
      throw new Error('Ping response was invalid.');
    }

    return {
      enabled: true,
      status: 'CONNECTED',
      primaryDatabase: 'Snowflake',
      role: 'OPTIONAL_SECONDARY_ADAPTER',
      mandatory: false,
      latencyMs,
      message: 'Secondary MySQL adapter is connected. Snowflake remains the mandatory primary database.'
    };
  } catch (err) {
    logger.warn(
      `[MySQLHealthCheck] Secondary MySQL ping failed: ${err.message}. Primary Snowflake database is unaffected.`
    );

    return {
      enabled: true,
      status: 'DISCONNECTED',
      primaryDatabase: 'Snowflake',
      role: 'OPTIONAL_SECONDARY_ADAPTER',
      mandatory: false,
      error: err.message,
      message: 'Secondary adapter unavailable; Snowflake remains the active primary database.'
    };
  }
}

module.exports = {
  checkMySQLHealth
};
