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

    // 1. Verify connection and log safe session context
    const connStatus = await connectionManager.testConnection();
    if (!connStatus.connected) {
      throw new Error(`Cannot initialize database: Snowflake connection failed (${connStatus.error})`);
    }

    logger.info('[DatabaseManager] Snowflake live connection confirmed:', {
      account: connStatus.account,
      region: connStatus.region,
      user: connStatus.user,
      role: connStatus.role,
      warehouse: connStatus.warehouse
    });

    // 2. Create Database IF NOT EXISTS
    logger.info(`[DatabaseManager] Ensuring database ${this.requiredDatabase} exists...`);
    await executor.execute(
      `CREATE DATABASE IF NOT EXISTS ${this.requiredDatabase} COMMENT = 'EduBridge Adaptive - Primary Application Database'`
    );

    // Verify database exists
    const dbRows = await executor.query(`SHOW DATABASES LIKE '${this.requiredDatabase}'`);
    const dbFound = dbRows.some(
      r => (r.name || r.NAME || '').toUpperCase() === this.requiredDatabase
    );
    if (!dbFound) {
      throw new Error(`Database verification failed: Database "${this.requiredDatabase}" was not found after creation.`);
    }
    logger.info(`[DatabaseManager] Database ${this.requiredDatabase} confirmed.`);

    // 3. Set context to EDUBRIDGE_ADAPTIVE
    await executor.execute(`USE DATABASE ${this.requiredDatabase}`);

    // 4. Create Schema IF NOT EXISTS
    logger.info(`[DatabaseManager] Ensuring schema ${this.requiredDatabase}.${this.requiredSchema} exists...`);
    await executor.execute(
      `CREATE SCHEMA IF NOT EXISTS ${this.requiredDatabase}.${this.requiredSchema} COMMENT = 'Core application entities schema'`
    );

    // Verify schema exists
    const schRows = await executor.query(
      `SHOW SCHEMAS LIKE '${this.requiredSchema}' IN DATABASE ${this.requiredDatabase}`
    );
    const schFound = schRows.some(
      r => (r.name || r.NAME || '').toUpperCase() === this.requiredSchema
    );
    if (!schFound) {
      throw new Error(`Schema verification failed: Schema "${this.requiredDatabase}.${this.requiredSchema}" was not found after creation.`);
    }
    logger.info(`[DatabaseManager] Schema ${this.requiredDatabase}.${this.requiredSchema} confirmed.`);

    await executor.execute(`USE SCHEMA ${this.requiredDatabase}.${this.requiredSchema}`);

    // 5. Run state-aware migrations idempotently
    logger.info('[DatabaseManager] Running schema migrations...');
    const migrationResult = await migrationRunner.runMigrations();

    // 6. Idempotently seed default users if not already present
    await this._seedDefaultUsers();

    // 7. Verify complete schema against live Snowflake INFORMATION_SCHEMA
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
   * Seed default system users idempotently if they do not exist
   * @private
   */
  async _seedDefaultUsers() {
    try {
      const defaultUsers = [
        {
          id: 'user_saswata_primary',
          email: 'saswataghatak70@gmail.com',
          fullName: 'Saswata Ghatak',
          passwordHash: '$2a$10$wE0v2GqW76V82dF1W15VdOcmFfGz5hU60MhO1fH6wD8B3a7O5wR/e',
          role: 'student',
          gradeLevel: 'Grade 12',
          preferredLanguage: 'en',
          preferences: { screenReader: true, highContrast: false, voiceSpeed: 1.0 }
        },
        {
          id: 'user_debansu_primary',
          email: 'debansumondal2304@gmail.com',
          fullName: 'Debansu Mondal',
          passwordHash: '$2a$10$NULKmernW8LPfhymdOjoJOueNE77s5teYWweR1yXStEdXLpLAb3SO',
          role: 'student',
          gradeLevel: 'Grade 12',
          preferredLanguage: 'en',
          preferences: { screenReader: true, highContrast: false, voiceSpeed: 1.0 }
        }
      ];

      for (const u of defaultUsers) {
        const rows = await executor.query(
          `SELECT ID, EMAIL FROM ${this.requiredDatabase}.${this.requiredSchema}.USERS WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(?))`,
          [u.email]
        );

        if (!rows || rows.length === 0) {
          logger.info(`[DatabaseManager] Seeding required user: ${u.email}`);
          await executor.execute(
            `INSERT INTO ${this.requiredDatabase}.${this.requiredSchema}.USERS 
             (USER_ID, ID, NAME, FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, GRADE_LEVEL, PREFERRED_LANGUAGE, ACCESSIBILITY_PREFERENCES, IS_ACTIVE) 
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), ?`,
            [
              u.id,
              u.id,
              u.fullName,
              u.fullName,
              u.email.toLowerCase().trim(),
              u.passwordHash,
              u.role,
              u.gradeLevel,
              u.preferredLanguage,
              JSON.stringify(u.preferences),
              true
            ]
          );
          logger.info(`[DatabaseManager] Seeded user ${u.email} successfully.`);
        }
      }
    } catch (err) {
      logger.warn('[DatabaseManager] Notice during user seeding:', err.message);
    }
  }

  /**
   * Execute pending migrations
   */
  async runMigrations() {
    return migrationRunner.runMigrations();
  }

  /**
   * Verify schema completeness against architectural mandates using live INFORMATION_SCHEMA:
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

    // 1. Check live connection
    const connStatus = await connectionManager.testConnection();
    if (!connStatus.connected) {
      return {
        isValid: false,
        connectionWorks: false,
        error: connStatus.error,
        errors: [`Connection failure: ${connStatus.error}`]
      };
    }

    // 2. Query live tables from INFORMATION_SCHEMA.TABLES
    let actualTables = [];
    try {
      const tableRows = await executor.query(
        `SELECT TABLE_NAME FROM ${this.requiredDatabase}.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${this.requiredSchema}' ORDER BY TABLE_NAME`
      );
      actualTables = tableRows.map(r => (r.TABLE_NAME || r.table_name || '').toUpperCase());
    } catch (err) {
      errors.push(`Failed to query INFORMATION_SCHEMA.TABLES: ${err.message}`);
    }

    // Check mandatory tables
    for (const mandatoryTable of this.mandatoryTables) {
      if (!actualTables.includes(mandatoryTable)) {
        missingTables.push(mandatoryTable);
        errors.push(`Missing mandatory table: ${this.requiredDatabase}.${this.requiredSchema}.${mandatoryTable}`);
      }
    }

    const mandatoryFound = actualTables.filter(t => this.mandatoryTables.includes(t));
    const unexpectedTables = actualTables.filter(
      t => !this.mandatoryTables.includes(t) && t !== 'SCHEMA_MIGRATIONS'
    );

    // 3. Query all columns in APP schema from INFORMATION_SCHEMA.COLUMNS
    let columnsByTable = {};
    try {
      const colRows = await executor.query(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM ${this.requiredDatabase}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${this.requiredSchema}' ORDER BY TABLE_NAME, ORDINAL_POSITION`
      );

      for (const row of colRows) {
        const tName = (row.TABLE_NAME || row.table_name || '').toUpperCase();
        const cName = (row.COLUMN_NAME || row.column_name || '').toUpperCase();
        if (!columnsByTable[tName]) {
          columnsByTable[tName] = [];
        }
        columnsByTable[tName].push(cName);
      }
    } catch (err) {
      errors.push(`Failed to query INFORMATION_SCHEMA.COLUMNS: ${err.message}`);
    }

    // Check critical columns for mandatory tables
    for (const mandatoryTable of this.mandatoryTables) {
      if (actualTables.includes(mandatoryTable)) {
        const tableCols = columnsByTable[mandatoryTable] || [];
        const expectedCols = this.criticalColumns[mandatoryTable] || [];
        const missingForTable = [];

        for (const expectedCol of expectedCols) {
          if (!tableCols.includes(expectedCol.toUpperCase())) {
            missingForTable.push(expectedCol);
            errors.push(`Table ${mandatoryTable} is missing expected column: ${expectedCol}`);
          }
        }

        if (missingForTable.length > 0) {
          missingColumns[mandatoryTable] = missingForTable;
        }
      }
    }

    const isValid = errors.length === 0 && missingTables.length === 0;

    return {
      isValid,
      connectionWorks: true,
      account: connStatus.account,
      region: connStatus.region,
      user: connStatus.user,
      role: connStatus.role,
      warehouse: connStatus.warehouse,
      database: this.requiredDatabase,
      schema: this.requiredSchema,
      expectedTables: this.mandatoryTables,
      actualTables,
      mandatoryFound,
      missingTables,
      unexpectedTables,
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
    const VARIANT_COLS = new Set([
      'ACCESSIBILITY_PREFERENCES',
      'AI_EVALUATION_METADATA',
      'ANSWERS_SUMMARY',
      'METADATA',
      'WAVEFORM_DATA',
      'DETAILS',
      'MASTERY_HISTORY',
      'INTERACTION_HISTORY',
      'AI_GENERATION_METADATA',
      'KEY_TAKEAWAYS',
      'SENSORY_ANALOGIES',
      'STRUCTURED_CONTENT',
      'ADAPTIVE_RUBRIC',
      'OPTIONS',
      'AI_METADATA',
      'DIAGRAM_DESCRIPTIONS'
    ]);

    const keys = Object.keys(data);
    const columns = keys.map(k => k.toUpperCase()).join(', ');
    const placeholders = keys.map(k => {
      const col = k.toUpperCase();
      return VARIANT_COLS.has(col) ? 'PARSE_JSON(?)' : '?';
    }).join(', ');

    const binds = keys.map(k => {
      const col = k.toUpperCase();
      const val = data[k];
      if (val === undefined || val === null) return null;
      if (VARIANT_COLS.has(col) || typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });

    const sql = `INSERT INTO ${this.requiredDatabase}.${this.requiredSchema}.${tableName.toUpperCase()} (${columns}) SELECT ${placeholders}`;
    await executor.execute(sql, binds);
    return data;
  }

  /**
   * Safe update helper for repositories
   */
  async update(tableName, data, whereClause, whereBinds = []) {
    const VARIANT_COLS = new Set([
      'ACCESSIBILITY_PREFERENCES',
      'AI_EVALUATION_METADATA',
      'ANSWERS_SUMMARY',
      'METADATA',
      'WAVEFORM_DATA',
      'DETAILS',
      'MASTERY_HISTORY',
      'INTERACTION_HISTORY',
      'AI_GENERATION_METADATA',
      'KEY_TAKEAWAYS',
      'SENSORY_ANALOGIES',
      'STRUCTURED_CONTENT',
      'ADAPTIVE_RUBRIC',
      'OPTIONS',
      'AI_METADATA',
      'DIAGRAM_DESCRIPTIONS'
    ]);

    const keys = Object.keys(data);
    const setClause = keys.map(k => {
      const col = k.toUpperCase();
      return VARIANT_COLS.has(col) ? `${col} = PARSE_JSON(?)` : `${col} = ?`;
    }).join(', ');

    const binds = keys.map(k => {
      const col = k.toUpperCase();
      const val = data[k];
      if (val === undefined || val === null) return null;
      if (VARIANT_COLS.has(col) || typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    }).concat((whereBinds || []).map(b => (b === undefined ? null : b)));

    const hasUpdatedAt = keys.some(k => k.toUpperCase() === 'UPDATED_AT');
    const updatedAtClause = hasUpdatedAt ? '' : ', UPDATED_AT = CURRENT_TIMESTAMP()';
    const sql = `UPDATE ${this.requiredDatabase}.${this.requiredSchema}.${tableName.toUpperCase()} SET ${setClause}${updatedAtClause} WHERE ${whereClause}`;
    await executor.execute(sql, binds);
    return data;
  }
}

const databaseManager = new DatabaseManager();
module.exports = databaseManager;
