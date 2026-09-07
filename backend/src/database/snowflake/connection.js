/**
 * EduBridge Adaptive - Snowflake Connection Manager
 *
 * CRITICAL ARCHITECTURE RULE:
 * Snowflake is the PRIMARY and MANDATORY database.
 * Never replace it with MongoDB, PostgreSQL, or MySQL.
 */

const fs = require('fs');
const path = require('path');
const snowflake = require('snowflake-sdk');
const logger = require('../../utils/logger');

// Disable noisy SDK logging by default
snowflake.configure({
  logLevel: 'ERROR'
});

class SnowflakeConnection {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this._mockMode = false;
    this._currentDatabase = process.env.SNOWFLAKE_DATABASE || 'EDUBRIDGE_ADAPTIVE';
    this._currentSchema = process.env.SNOWFLAKE_SCHEMA || 'APP';

    this._mockFilePath = path.resolve(__dirname, '..', '..', '..', '.snowflake_mock.json');
    this._mockStore = this._loadMockStore();

    this._checkMockMode();
  }

  _loadMockStore() {
    try {
      if (fs.existsSync(this._mockFilePath)) {
        const raw = fs.readFileSync(this._mockFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.databases) {
          return parsed;
        }
      }
    } catch (err) {
      logger.warn('[SnowflakeConnection] Could not read mock file:', err.message);
    }
    return {
      databases: {
        'EDUBRIDGE_ADAPTIVE': {
          schemas: {
            'APP': {
              tables: {}
            }
          }
        }
      }
    };
  }

  saveMockStore() {
    try {
      fs.writeFileSync(this._mockFilePath, JSON.stringify(this._mockStore, null, 2), 'utf8');
    } catch (err) {
      logger.warn('[SnowflakeConnection] Could not save mock file:', err.message);
    }
  }

  _checkMockMode() {
    const hasAccount = Boolean(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_ACCOUNT.trim());
    const hasUsername = Boolean(process.env.SNOWFLAKE_USERNAME && process.env.SNOWFLAKE_USERNAME.trim());
    const hasPassword = Boolean(process.env.SNOWFLAKE_PASSWORD && process.env.SNOWFLAKE_PASSWORD.trim());
    const isTest = process.env.NODE_ENV === 'test';

    if (this._fallbackTriggered) {
      this._mockMode = true;
      return;
    }

    this._mockMode = isTest || !hasAccount || !hasUsername || !hasPassword;
  }

  isMockMode() {
    this._checkMockMode();
    return this._mockMode;
  }

  setMockMode(isMock) {
    this._mockMode = Boolean(isMock);
  }

  getCurrentDatabase() {
    return this._currentDatabase;
  }

  getCurrentSchema() {
    return this._currentSchema;
  }

  setCurrentDatabase(db) {
    this._currentDatabase = (db || '').toUpperCase();
  }

  setCurrentSchema(schema) {
    this._currentSchema = (schema || '').toUpperCase();
  }

  getMockStore() {
    return this._mockStore;
  }

  resetMockStore() {
    this._mockStore = {
      databases: {}
    };
    try {
      if (fs.existsSync(this._mockFilePath)) {
        fs.unlinkSync(this._mockFilePath);
      }
    } catch {}
  }

  /**
   * Connect to Snowflake or initialize mock session.
   * Never exposes credentials in logs.
   */
  async getConnection() {
    if (this.isMockMode()) {
      return { mock: true, database: this._currentDatabase, schema: this._currentSchema };
    }

    if (this.connection) {
      if (typeof this.connection.isUp === 'function' && !this.connection.isUp()) {
        logger.warn('[SnowflakeConnection] Cached connection is no longer active (isUp=false). Re-establishing...');
        this.connection = null;
      } else {
        return this.connection;
      }
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getConnection();
    }

    this.isConnecting = true;

    try {
      const connConfig = {
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USERNAME,
        password: process.env.SNOWFLAKE_PASSWORD,
        database: this._currentDatabase,
        schema: this._currentSchema,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN',
        clientSessionKeepAlive: true
      };

      const timeoutMs = parseInt(process.env.SNOWFLAKE_TIMEOUT_MS, 10) || 20000;

      logger.info('[SnowflakeConnection] Establishing live connection to Snowflake...', {
        account: connConfig.account,
        database: connConfig.database,
        schema: connConfig.schema,
        warehouse: connConfig.warehouse,
        timeoutMs
      });

      this.connection = await Promise.race([
        new Promise((resolve, reject) => {
          const conn = snowflake.createConnection(connConfig);
          conn.connect((err, establishedConn) => {
            if (err) {
              reject(new Error(`Failed to connect to Snowflake: ${err.message}`));
            } else {
              resolve(establishedConn);
            }
          });
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Snowflake connection timeout (${timeoutMs}ms)`)), timeoutMs)
        )
      ]);

      logger.info('[SnowflakeConnection] Successfully connected to live Snowflake warehouse.');
      return this.connection;
    } catch (error) {
      this.connection = null;
      logger.error('[SnowflakeConnection] Connection error:', { message: error.message });
      if (process.env.SNOWFLAKE_MOCK_FALLBACK === 'true') {
        logger.warn('[SnowflakeConnection] Falling back to mock mode due to live connection failure.');
        this._fallbackTriggered = true;
        this._mockMode = true;
        return { mock: true, database: this._currentDatabase, schema: this._currentSchema };
      }
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Test connection liveness
   */
  async testConnection() {
    if (this.isMockMode()) {
      return {
        connected: true,
        mode: 'MOCK_SIMULATION',
        database: this._currentDatabase,
        schema: this._currentSchema,
        latencyMs: 1
      };
    }

    const start = Date.now();
    try {
      const conn = await this.getConnection();
      if (!conn || conn.mock || this.isMockMode() || typeof conn.execute !== 'function') {
        return {
          connected: true,
          mode: 'MOCK_SIMULATION',
          database: this._currentDatabase,
          schema: this._currentSchema,
          latencyMs: Date.now() - start
        };
      }

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: 'SELECT CURRENT_DATABASE() AS DB, CURRENT_SCHEMA() AS SCH, CURRENT_WAREHOUSE() AS WH',
          complete: (err, stmt, rows) => {
            if (err) {
              reject(new Error(`Snowflake ping query failed: ${err.message}`));
            } else {
              const row = (rows && rows[0]) || {};
              resolve({
                connected: true,
                mode: 'LIVE_SNOWFLAKE',
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
      logger.info('[SnowflakeConnection] Snowflake connection closed.');
    }
  }
}

const snowflakeConnection = new SnowflakeConnection();
module.exports = snowflakeConnection;
