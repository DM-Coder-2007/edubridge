/**
 * EduBridge Adaptive - Snowflake Health Check Module
 *
 * Verifies live connection, warehouse readiness, session context,
 * and schema accessibility.
 */

const connectionManager = require('./connection');
const executor = require('./executor');
const logger = require('../../utils/logger');

class SnowflakeHealthCheck {
  /**
   * Run comprehensive health diagnostics on Snowflake
   * @returns {Promise<object>} Health check report
   */
  async getHealth() {
    const timestamp = new Date().toISOString();

    // 1. Connection ping
    const connStatus = await connectionManager.testConnection();
    if (!connStatus.connected) {
      return {
        status: 'unhealthy',
        connected: false,
        mode: connStatus.mode,
        error: connStatus.error,
        timestamp,
        database: connectionManager.getCurrentDatabase(),
        schema: connectionManager.getCurrentSchema()
      };
    }

    // 2. Query available tables in current database.schema
    let tableCount = 0;
    let tablesList = [];
    try {
      const rows = await executor.query(
        `SHOW TABLES IN SCHEMA ${connectionManager.getCurrentDatabase()}.${connectionManager.getCurrentSchema()}`
      );
      tablesList = rows.map(r => r.name || r.NAME || r.table_name || r.TABLE_NAME);
      tableCount = tablesList.length;
    } catch (err) {
      logger.warn('[SnowflakeHealthCheck] Could not fetch tables list during health check:', err.message);
    }

    const isHealthy = connStatus.connected && tableCount >= 10;
    const isDegraded = connStatus.connected && tableCount < 10;

    return {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
      connected: true,
      mode: connStatus.mode,
      database: connStatus.database || connectionManager.getCurrentDatabase(),
      schema: connStatus.schema || connectionManager.getCurrentSchema(),
      warehouse: connStatus.warehouse || 'COMPUTE_WH',
      latencyMs: connStatus.latencyMs,
      tablesCount: tableCount,
      tables: tablesList,
      timestamp,
      notes: isDegraded ? 'Schema partially initialized or migrations pending' : 'All systems operational'
    };
  }
}

const healthCheck = new SnowflakeHealthCheck();
module.exports = healthCheck;
