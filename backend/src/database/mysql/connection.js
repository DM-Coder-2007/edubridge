/**
 * EduBridge Adaptive - MySQL Connection Manager (Optional Secondary Adapter)
 *
 * ARCHITECTURAL STATEMENT:
 * "MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database."
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Snowflake is the PRIMARY and MANDATORY database. Single source of truth.
 * 2. MySQL must NEVER replace Snowflake or become the primary database.
 * 3. MySQL failure must NEVER silently change or degrade the primary application database.
 * 4. By default, MySQL is DISABLED (MYSQL_ENABLED=false).
 * 5. Database access must only occur behind repository interfaces.
 */

const mysql = require('mysql2/promise');
const config = require('../../config');
const logger = require('../../utils/logger');

class MySQLConnectionManager {
  constructor() {
    this._pool = null;
    this._isEnabled = process.env.MYSQL_ENABLED === 'true' || config.mysql?.enabled === true;
    this._mockMode = process.env.MYSQL_MOCK_FALLBACK === 'true' || process.env.NODE_ENV === 'test';

    if (this._isEnabled) {
      logger.info('[MySQLConnection] Optional secondary adapter is ENABLED.');
    } else {
      logger.info(
        '[MySQLConnection] MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database.'
      );
    }
  }

  /**
   * Check if MySQL secondary adapter is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this._isEnabled;
  }

  /**
   * Programmatically set enabled status (for testing)
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._isEnabled = Boolean(enabled);
  }

  /**
   * Return whether this database is primary (Always false: Snowflake is primary)
   * @returns {boolean}
   */
  isPrimary() {
    return false;
  }

  /**
   * Return primary database engine designation
   * @returns {string}
   */
  getPrimaryDatabaseEngine() {
    return 'Snowflake';
  }

  /**
   * Initialize or retrieve MySQL connection pool
   * Returns null if disabled
   * @returns {Promise<object|null>}
   */
  async getPool() {
    if (!this._isEnabled) {
      return null;
    }

    if (!this._pool) {
      try {
        const poolConfig = {
          host: process.env.MYSQL_HOST || config.mysql?.host || 'localhost',
          port: parseInt(process.env.MYSQL_PORT || config.mysql?.port || '3306', 10),
          user: process.env.MYSQL_USER || config.mysql?.user || 'root',
          password: process.env.MYSQL_PASSWORD || config.mysql?.password || '',
          database: process.env.MYSQL_DATABASE || config.mysql?.database || 'edubridge_secondary',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 5000
        };

        this._pool = mysql.createPool(poolConfig);
        logger.info(`[MySQLConnection] Created pool connected to ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
      } catch (err) {
        logger.warn(
          `[MySQLConnection] Failed to initialize secondary MySQL pool: ${err.message}. Snowflake remains unaffected as primary database.`
        );
        this._pool = null;
      }
    }

    return this._pool;
  }

  /**
   * Execute query safely on secondary adapter
   * If disabled or failing, logs warning and returns empty array without affecting Snowflake
   * @param {string} sql
   * @param {Array} [params=[]]
   * @returns {Promise<Array|null>}
   */
  async execute(sql, params = []) {
    if (!this._isEnabled) {
      logger.debug('[MySQLConnection] Query skipped: MySQL is disabled.');
      return [];
    }

    try {
      const pool = await this.getPool();
      if (!pool) return [];
      const [rows] = await pool.execute(sql, params);
      return rows || [];
    } catch (err) {
      logger.warn(
        `[MySQLConnection] Secondary query failed: ${err.message}. Snowflake remains the primary database.`
      );
      return [];
    }
  }

  /**
   * Gracefully close pool connections
   */
  async close() {
    if (this._pool) {
      try {
        await this._pool.end();
        this._pool = null;
        logger.info('[MySQLConnection] Closed secondary MySQL pool.');
      } catch (err) {
        logger.warn('[MySQLConnection] Error closing pool:', err.message);
      }
    }
  }
}

const mysqlConnection = new MySQLConnectionManager();
module.exports = mysqlConnection;
