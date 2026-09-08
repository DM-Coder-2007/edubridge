/**
 * EduBridge Adaptive - Snowflake Connection Manager
 *
 * CRITICAL ARCHITECTURE RULE:
 * Snowflake is the PRIMARY and MANDATORY database.
 * Never replace it with MongoDB, PostgreSQL, SQLite, or mock databases.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const snowflake = require('snowflake-sdk');
const logger = require('../../utils/logger');

// Load environment variables reliably across working directories
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// Configure SDK logging
snowflake.configure({
  logLevel: process.env.SNOWFLAKE_LOG_LEVEL || 'ERROR'
});

const REQUIRED_DATABASE = 'EDUBRIDGE_ADAPTIVE';
const REQUIRED_SCHEMA = 'APP';

class SnowflakeConnection {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this._currentDatabase = (process.env.SNOWFLAKE_DATABASE || REQUIRED_DATABASE).toUpperCase();
    this._currentSchema = (process.env.SNOWFLAKE_SCHEMA || REQUIRED_SCHEMA).toUpperCase();
    this._sessionContext = null;
  }

  isMockMode() {
    return false;
  }

  getCurrentDatabase() {
    return this._currentDatabase;
  }

  getCurrentSchema() {
    return this._currentSchema;
  }

  setCurrentDatabase(db) {
    this._currentDatabase = (db || REQUIRED_DATABASE).toUpperCase();
  }

  setCurrentSchema(schema) {
    this._currentSchema = (schema || REQUIRED_SCHEMA).toUpperCase();
  }

  resetMockStore() {
    // Compatibility method for test isolation
  }

  getSessionContext() {
    return this._sessionContext;
  }

  /**
   * Connect to Snowflake and return the active snowflake-sdk Connection instance.
   * Explicitly sets session warehouse, logs safe diagnostics, and does NOT leak credentials.
   *
   * @returns {Promise<object>} Active Snowflake SDK connection instance
   */
  async getConnection() {
    if (this.connection) {
      if (typeof this.connection.isUp === 'function' && !this.connection.isUp()) {
        logger.warn('[SnowflakeConnection] Cached connection is no longer active. Re-establishing...');
        this.connection = null;
      } else {
        return this.connection;
      }
    }

    if (this.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return this.getConnection();
    }

    this.isConnecting = true;

    try {
      const account = process.env.SNOWFLAKE_ACCOUNT;
      const username = process.env.SNOWFLAKE_USERNAME;
      const password = process.env.SNOWFLAKE_PASSWORD;
      const warehouse = process.env.SNOWFLAKE_WAREHOUSE || 'edubridge';
      const role = process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN';

      if (!account || !username || !password) {
        const missing = [];
        if (!account) missing.push('SNOWFLAKE_ACCOUNT');
        if (!username) missing.push('SNOWFLAKE_USERNAME');
        if (!password) missing.push('SNOWFLAKE_PASSWORD');
        throw new Error(`Missing mandatory Snowflake credentials in environment: ${missing.join(', ')}`);
      }

      const timeoutMs = parseInt(process.env.SNOWFLAKE_TIMEOUT_MS, 10) || 30000;

      logger.info('[SnowflakeConnection] Establishing live connection to Snowflake...', {
        account,
        user: username,
        role,
        warehouse,
        database: this._currentDatabase,
        schema: this._currentSchema
      });

      const connConfig = {
        account,
        username,
        password,
        role,
        warehouse,
        database: this._currentDatabase,
        schema: this._currentSchema,
        clientSessionKeepAlive: true
      };

      let conn;
      try {
        conn = await Promise.race([
          new Promise((resolve, reject) => {
            const client = snowflake.createConnection(connConfig);
            client.connect((err, establishedConn) => {
              if (err) {
                reject(err);
              } else {
                resolve(establishedConn);
              }
            });
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Snowflake connection timeout (${timeoutMs}ms)`)), timeoutMs)
          )
        ]);
      } catch (connErr) {
        // If connection failed because database or schema does not exist yet (e.g. before initial migration)
        const errMsg = connErr.message || '';
        if (errMsg.includes('does not exist') || connErr.code === '002003' || connErr.code === '390144') {
          logger.warn(`[SnowflakeConnection] Target database/schema not found on connect. Connecting without DB/schema context to permit initialization...`);
          const fallbackConfig = {
            account,
            username,
            password,
            role,
            warehouse,
            clientSessionKeepAlive: true
          };
          conn = await Promise.race([
            new Promise((resolve, reject) => {
              const client = snowflake.createConnection(fallbackConfig);
              client.connect((err, establishedConn) => {
                if (err) {
                  reject(new Error(`Failed to authenticate with Snowflake: ${err.message}`));
                } else {
                  resolve(establishedConn);
                }
              });
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Snowflake connection timeout (${timeoutMs}ms)`)), timeoutMs)
            )
          ]);
        } else {
          throw new Error(`Failed to authenticate with Snowflake: ${connErr.message}`);
        }
      }

      // Ensure active session context is explicitly set to target warehouse, database, and schema
      try {
        await new Promise((resolve) => {
          conn.execute({
            sqlText: `USE WAREHOUSE ${warehouse}`,
            complete: () => resolve()
          });
        });
        await new Promise((resolve) => {
          conn.execute({
            sqlText: `USE DATABASE ${this._currentDatabase}`,
            complete: () => resolve()
          });
        });
        await new Promise((resolve) => {
          conn.execute({
            sqlText: `USE SCHEMA ${this._currentDatabase}.${this._currentSchema}`,
            complete: () => resolve()
          });
        });
      } catch (contextErr) {
        logger.debug('[SnowflakeConnection] Notice while setting session context:', contextErr.message);
      }

      // Query active session diagnostics safely
      const sessionDiagnostics = await new Promise((resolve, reject) => {
        conn.execute({
          sqlText: 'SELECT CURRENT_ACCOUNT() AS ACCOUNT, CURRENT_REGION() AS REGION, CURRENT_USER() AS "USER", CURRENT_ROLE() AS "ROLE", CURRENT_DATABASE() AS DB, CURRENT_SCHEMA() AS SCH, CURRENT_WAREHOUSE() AS WH',
          complete: (err, stmt, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve((rows && rows[0]) || {});
            }
          }
        });
      });

      this._sessionContext = {
        account: sessionDiagnostics.ACCOUNT || account,
        region: sessionDiagnostics.REGION || 'UNKNOWN',
        user: sessionDiagnostics.USER || username,
        role: sessionDiagnostics.ROLE || role,
        database: sessionDiagnostics.DB || this._currentDatabase,
        schema: sessionDiagnostics.SCH || this._currentSchema,
        warehouse: sessionDiagnostics.WH || warehouse
      };

      logger.info('[SnowflakeConnection] Successfully connected to Snowflake warehouse.', {
        account: this._sessionContext.account,
        region: this._sessionContext.region,
        user: this._sessionContext.user,
        role: this._sessionContext.role,
        warehouse: this._sessionContext.warehouse,
        database: this._sessionContext.database || 'NONE',
        schema: this._sessionContext.schema || 'NONE'
      });

      this.connection = conn;
      return this.connection;
    } catch (error) {
      this.connection = null;
      logger.error('[SnowflakeConnection] Connection error:', { message: error.message });
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Test connection liveness against live Snowflake
   * @returns {Promise<object>}
   */
  async testConnection() {
    const start = Date.now();
    try {
      const conn = await this.getConnection();
      if (!conn || typeof conn.execute !== 'function') {
        throw new Error('Snowflake connection is invalid: execute is not a function');
      }

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: 'SELECT CURRENT_ACCOUNT() AS ACCOUNT, CURRENT_REGION() AS REGION, CURRENT_USER() AS "USER", CURRENT_ROLE() AS "ROLE", CURRENT_DATABASE() AS DB, CURRENT_SCHEMA() AS SCH, CURRENT_WAREHOUSE() AS WH',
          complete: (err, stmt, rows) => {
            if (err) {
              reject(new Error(`Snowflake ping query failed: ${err.message}`));
            } else {
              const row = (rows && rows[0]) || {};
              resolve({
                connected: true,
                mode: 'LIVE_SNOWFLAKE',
                account: row.ACCOUNT,
                region: row.REGION,
                user: row.USER,
                role: row.ROLE,
                database: row.DB || this._currentDatabase,
                schema: row.SCH || this._currentSchema,
                warehouse: row.WH || 'UNKNOWN',
                latencyMs: Date.now() - start
              });
            }
          }
        });
      });
    } catch (err) {
      return {
        connected: false,
        mode: 'LIVE_SNOWFLAKE',
        error: err.message,
        latencyMs: Date.now() - start
      };
    }
  }

  /**
   * Gracefully close connection
   */
  async closeConnection() {
    if (this.connection) {
      await new Promise((resolve) => {
        this.connection.destroy((err) => {
          if (err) {
            logger.warn('[SnowflakeConnection] Error destroying connection:', { message: err.message });
          }
          resolve();
        });
      });
      this.connection = null;
      this._sessionContext = null;
      logger.info('[SnowflakeConnection] Snowflake connection closed.');
    }
  }

  async destroyConnection() {
    return this.closeConnection();
  }
}

const snowflakeConnection = new SnowflakeConnection();
module.exports = snowflakeConnection;
