/**
 * EduBridge Adaptive - Central Snowflake Database Manager
 *
 * CRITICAL ARCHITECTURE RULE:
 * Snowflake is the PRIMARY and MANDATORY database.
 *
 * Exposes the mandatory Database Manager API:
 * - initializeDatabase()
 * - runMigrations()
 * - verifySchema()
 * - getDatabaseHealth()
 * - closeConnection()
 */

const connectionManager = require('./connection');
const executor = require('./executor');
const migrationRunner = require('./migrationRunner');
const healthCheck = require('./healthCheck');
const logger = require('../../utils/logger');

const REQUIRED_DATABASE = 'EDUBRIDGE_ADAPTIVE';
const REQUIRED_SCHEMA = 'APP';

const MANDATORY_TABLES = [
  'USERS',
  'TEXTBOOK_ASSETS',
  'LESSONS',
  'CONCEPTS',
  'QUESTIONS',
  'ATTEMPTS',
  'CONCEPT_MASTERY',
  'AUDIO_ASSETS',
  'LEARNING_SESSIONS',
  'AUDIT_LOGS'
];

const CRITICAL_COLUMNS = {
  USERS: ['USER_ID', 'NAME', 'EMAIL', 'PASSWORD_HASH'],
  TEXTBOOK_ASSETS: ['IMAGE_ID', 'USER_ID', 'ORIGINAL_URL', 'PROCESSED_URL', 'CLOUDINARY_PUBLIC_ID', 'ASSET_TYPE', 'PROCESSING_STATUS'],
  LESSONS: ['LESSON_ID', 'USER_ID', 'IMAGE_ID', 'TITLE', 'RAW_TEXT', 'STRUCTURED_CONTENT', 'DIFFICULTY', 'PROCESSING_STATUS', 'AI_MODEL'],
  CONCEPTS: ['CONCEPT_ID', 'LESSON_ID', 'CONCEPT_NAME', 'EXPLANATION', 'DIFFICULTY', 'ORDER_INDEX'],
  QUESTIONS: ['QUESTION_ID', 'LESSON_ID', 'CONCEPT_ID', 'QUESTION_TEXT', 'QUESTION_TYPE', 'OPTIONS', 'CORRECT_ANSWER', 'EXPLANATION', 'DIFFICULTY'],
  ATTEMPTS: ['ATTEMPT_ID', 'USER_ID', 'LESSON_ID', 'QUESTION_ID', 'ANSWER', 'IS_CORRECT', 'TIME_TAKEN_SECONDS'],
  CONCEPT_MASTERY: ['USER_ID', 'CONCEPT_ID', 'ATTEMPTS', 'CORRECT_ATTEMPTS', 'MASTERY_SCORE', 'LAST_UPDATED'],
  AUDIO_ASSETS: ['AUDIO_ID', 'LESSON_ID', 'USER_ID', 'CLOUDINARY_PUBLIC_ID', 'AUDIO_URL', 'WAVEFORM_URL', 'DURATION_SECONDS', 'VOICE', 'FORMAT'],
  LEARNING_SESSIONS: ['SESSION_ID', 'USER_ID', 'LESSON_ID', 'STARTED_AT', 'ENDED_AT', 'QUESTIONS_ATTEMPTED', 'QUESTIONS_CORRECT', 'TOTAL_TIME_SECONDS'],
  AUDIT_LOGS: ['AUDIT_ID', 'USER_ID', 'ACTION', 'ENTITY_TYPE', 'ENTITY_ID', 'STATUS', 'METADATA']
};

class DatabaseManager {
  constructor() {
    this.requiredDatabase = REQUIRED_DATABASE;
    this.requiredSchema = REQUIRED_SCHEMA;
    this.mandatoryTables = MANDATORY_TABLES;
    this.criticalColumns = CRITICAL_COLUMNS;
  }

  /**
   * Initialize Snowflake database and schema idempotently.
   * Creates EDUBRIDGE_ADAPTIVE and APP schema if not exist,
   * applies all pending migrations, and verifies schema validity.
   *
   * @returns {Promise<object>} Initialization report
   */
  async initializeDatabase() {
    logger.info('===============================================================');
    logger.info(`[DatabaseManager] Initializing Snowflake: ${this.requiredDatabase}.${this.requiredSchema}`);
    logger.info('CRITICAL: Snowflake is the PRIMARY and MANDATORY database.');
    logger.info('===============================================================');

    // 1. Verify connection
    const connStatus = await connectionManager.testConnection();
    if (!connStatus.connected) {
      throw new Error(`Cannot initialize database: Snowflake connection failed (${connStatus.error})`);
    }

    // 2. Create Database IF NOT EXISTS (never drop or replace production databases)
    logger.info(`[DatabaseManager] Ensuring database ${this.requiredDatabase} exists...`);
    await executor.execute(`CREATE DATABASE IF NOT EXISTS ${this.requiredDatabase} COMMENT = 'EduBridge Adaptive - Primary Application Database'`);

    // 3. Set context to EDUBRIDGE_ADAPTIVE
    await executor.execute(`USE DATABASE ${this.requiredDatabase}`);

    // 4. Create Schema IF NOT EXISTS
    logger.info(`[DatabaseManager] Ensuring schema ${this.requiredDatabase}.${this.requiredSchema} exists...`);
    await executor.execute(`CREATE SCHEMA IF NOT EXISTS ${this.requiredDatabase}.${this.requiredSchema} COMMENT = 'Core application entities schema'`);
    await executor.execute(`USE SCHEMA ${this.requiredDatabase}.${this.requiredSchema}`);

    // 5. Run migrations idempotently
    logger.info('[DatabaseManager] Running schema migrations...');
    const migrationResult = await migrationRunner.runMigrations();

    // 6. Verify complete schema
    logger.info('[DatabaseManager] Verifying schema integrity...');
    const verification = await this.verifySchema();

    if (!verification.isValid) {
      logger.error('[DatabaseManager] Schema verification detected issues:', verification);
      throw new Error(`Schema verification failed after initialization: ${verification.errors.join(', ')}`);
    }

    logger.info('===============================================================');
    logger.info(`[DatabaseManager] Initialization Complete. All ${this.mandatoryTables.length} mandatory tables verified.`);
    logger.info('===============================================================');

    return {
      success: true,
      database: this.requiredDatabase,
      schema: this.requiredSchema,
      migrationsApplied: migrationResult.applied,
      verification
    };
  }

  /**
   * Execute pending migrations
   */
  async runMigrations() {
    return migrationRunner.runMigrations();
  }

  /**
   * Verify schema completeness against architectural mandates:
   * - database exists
   * - APP schema exists
   * - every required table exists
   * - expected critical columns exist
   * - connection works
   * - current database/schema are correct
   *
   * @returns {Promise<object>} Verification report
   */
  async verifySchema() {
    const errors = [];
    const missingTables = [];
    const missingColumns = {};

    // 1. Check connection
    const connStatus = await connectionManager.testConnection();
    if (!connStatus.connected) {
      return {
        isValid: false,
        connectionWorks: false,
        error: connStatus.error,
        errors: [`Connection failure: ${connStatus.error}`]
      };
    }

    // 2. Verify current database context
    const currentDb = connectionManager.getCurrentDatabase();
    if (currentDb !== this.requiredDatabase) {
      errors.push(`Current database context is "${currentDb}", expected "${this.requiredDatabase}"`);
    }

    // 3. Verify current schema context
    const currentSch = connectionManager.getCurrentSchema();
    if (currentSch !== this.requiredSchema) {
      errors.push(`Current schema context is "${currentSch}", expected "${this.requiredSchema}"`);
    }

    // 4. Verify tables in APP schema
    let existingTableNames = [];
    try {
      const tableRows = await executor.query(
        `SHOW TABLES IN SCHEMA ${this.requiredDatabase}.${this.requiredSchema}`
      );
      existingTableNames = tableRows.map(r => (r.name || r.NAME || r.table_name || r.TABLE_NAME || '').toUpperCase());
    } catch (err) {
      errors.push(`Failed to list tables in schema ${this.requiredDatabase}.${this.requiredSchema}: ${err.message}`);
    }

    // Check each mandatory table
    for (const mandatoryTable of this.mandatoryTables) {
      if (!existingTableNames.includes(mandatoryTable)) {
        missingTables.push(mandatoryTable);
        errors.push(`Missing mandatory table: ${this.requiredDatabase}.${this.requiredSchema}.${mandatoryTable}`);
      }
    }

    // 5. Verify critical columns for all found tables
    for (const mandatoryTable of this.mandatoryTables) {
      if (existingTableNames.includes(mandatoryTable)) {
        try {
          const colRows = await executor.query(
            `DESCRIBE TABLE ${this.requiredDatabase}.${this.requiredSchema}.${mandatoryTable}`
          );
          const existingColNames = colRows.map(c => (c.name || c.NAME || c.column_name || c.COLUMN_NAME || '').toUpperCase());

          const expectedCols = this.criticalColumns[mandatoryTable] || [];
          const missingForTable = [];
          for (const expectedCol of expectedCols) {
            if (!existingColNames.includes(expectedCol)) {
              missingForTable.push(expectedCol);
              errors.push(`Table ${mandatoryTable} is missing expected column: ${expectedCol}`);
            }
          }

          if (missingForTable.length > 0) {
            missingColumns[mandatoryTable] = missingForTable;
          }
        } catch (err) {
          errors.push(`Failed to describe table ${mandatoryTable}: ${err.message}`);
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      connectionWorks: true,
      database: currentDb,
      schema: currentSch,
      tablesFound: existingTableNames.filter(t => this.mandatoryTables.includes(t)),
      totalTablesInSchema: existingTableNames.length,
      missingTables,
      missingColumns,
      errors
    };
  }

  /**
   * Get database health diagnostics
   */
  async getDatabaseHealth() {
    return healthCheck.getHealth();
  }

  /**
   * Close connection
   */
  async closeConnection() {
    return connectionManager.closeConnection();
  }

  /**
   * Safe query helper for repositories
   */
  async query(sqlText, binds = []) {
    return executor.query(sqlText, binds);
  }

  /**
   * Safe query single row helper for repositories
   */
  async queryOne(sqlText, binds = []) {
    return executor.queryOne(sqlText, binds);
  }

  /**
   * Safe insert helper for repositories
   */
  async insert(tableName, data) {
    const keys = Object.keys(data);
    const columns = keys.map(k => k.toUpperCase()).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const binds = keys.map(k => {
      const val = data[k];
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });

    const sql = `INSERT INTO ${this.requiredDatabase}.${this.requiredSchema}.${tableName.toUpperCase()} (${columns}) VALUES (${placeholders})`;
    await executor.execute(sql, binds);
    return data;
  }

  /**
   * Safe update helper for repositories
   */
  async update(tableName, data, whereClause, whereBinds = []) {
    const keys = Object.keys(data);
    const setClause = keys.map(k => `${k.toUpperCase()} = ?`).join(', ');
    const binds = keys.map(k => {
      const val = data[k];
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    }).concat(whereBinds);

    const sql = `UPDATE ${this.requiredDatabase}.${this.requiredSchema}.${tableName.toUpperCase()} SET ${setClause}, UPDATED_AT = CURRENT_TIMESTAMP() WHERE ${whereClause}`;
    await executor.execute(sql, binds);
    return data;
  }
}

const databaseManager = new DatabaseManager();
module.exports = databaseManager;
