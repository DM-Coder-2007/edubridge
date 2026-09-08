/**
 * EduBridge Adaptive - Snowflake Migration Runner
 *
 * Executes versioned DDL migrations safely, idempotently, and state-aware.
 * Tracks applied migrations in EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS.
 * If a migration is recorded as executed BUT its required object does not exist
 * in live Snowflake, it safely repairs and re-runs the migration.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const executor = require('./executor');
const logger = require('../../utils/logger');

const MIGRATION_TARGETS = {
  '001_create_database.sql': { type: 'DATABASE', name: 'EDUBRIDGE_ADAPTIVE' },
  '002_create_schema.sql': { type: 'SCHEMA', name: 'APP' },
  '003_create_users.sql': { type: 'TABLE', name: 'USERS' },
  '004_create_textbook_assets.sql': { type: 'TABLE', name: 'TEXTBOOK_ASSETS' },
  '005_create_lessons.sql': { type: 'TABLE', name: 'LESSONS' },
  '006_create_concepts.sql': { type: 'TABLE', name: 'CONCEPTS' },
  '007_create_questions.sql': { type: 'TABLE', name: 'QUESTIONS' },
  '008_create_attempts.sql': { type: 'TABLE', name: 'ATTEMPTS' },
  '009_create_concept_mastery.sql': { type: 'TABLE', name: 'CONCEPT_MASTERY' },
  '010_create_audio_assets.sql': { type: 'TABLE', name: 'AUDIO_ASSETS' },
  '011_create_learning_sessions.sql': { type: 'TABLE', name: 'LEARNING_SESSIONS' },
  '012_create_audit_logs.sql': { type: 'TABLE', name: 'AUDIT_LOGS' }
};

class MigrationRunner {
  constructor() {
    this.migrationDirs = [
      path.resolve(process.cwd(), 'database', 'snowflake', 'migrations'),
      path.resolve(process.cwd(), 'backend', 'database', 'snowflake', 'migrations'),
      path.resolve(__dirname, '..', '..', '..', 'database', 'snowflake', 'migrations'),
      path.resolve(__dirname, '..', '..', '..', '..', 'database', 'snowflake', 'migrations')
    ];
  }

  /**
   * Locate existing migrations directory
   */
  getMigrationsDir() {
    for (const dir of this.migrationDirs) {
      if (fs.existsSync(dir)) {
        return dir;
      }
    }
    throw new Error(`Migrations directory not found. Checked:\n  ${this.migrationDirs.join('\n  ')}`);
  }

  /**
   * List all SQL migration files in sorted order
   */
  getMigrationFiles() {
    const dir = this.getMigrationsDir();
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return files.map(file => ({
      filename: file,
      fullPath: path.join(dir, file),
      target: MIGRATION_TARGETS[file] || null
    }));
  }

  /**
   * Ensure SCHEMA_MIGRATIONS tracking table exists in APP schema
   */
  async ensureTrackingTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS (
        migration_file VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        checksum VARCHAR(64),
        execution_time_ms NUMBER(10, 0),
        status VARCHAR(50) DEFAULT 'SUCCESS'
      )
      COMMENT = 'Internal schema migration registry';
    `;
    await executor.execute(sql);
  }

  /**
   * Retrieve list of recorded successful migrations from SCHEMA_MIGRATIONS table
   */
  async getRecordedMigrations() {
    await this.ensureTrackingTable();
    try {
      const rows = await executor.query(
        'SELECT migration_file, applied_at, checksum, status FROM EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS WHERE status = ?',
        ['SUCCESS']
      );
      return rows.map(r => (r.MIGRATION_FILE || r.migration_file || '').trim());
    } catch {
      return [];
    }
  }

  /**
   * Get list of live tables actually present in EDUBRIDGE_ADAPTIVE.APP
   */
  async getLiveAppTables() {
    try {
      const rows = await executor.query(
        "SELECT TABLE_NAME FROM EDUBRIDGE_ADAPTIVE.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'APP'"
      );
      return rows.map(r => (r.TABLE_NAME || r.table_name || '').toUpperCase());
    } catch (err) {
      logger.warn('[MigrationRunner] Could not query INFORMATION_SCHEMA.TABLES:', err.message);
      return [];
    }
  }

  /**
   * Determine migrations that need to be run.
   * State-aware: if a migration is marked as applied BUT its target table does not exist
   * in live Snowflake, it is flagged for safe repair.
   */
  async getPendingAndRepairMigrations() {
    const allFiles = this.getMigrationFiles();
    const recorded = await this.getRecordedMigrations();
    const liveTables = await this.getLiveAppTables();

    const toExecute = [];

    for (const file of allFiles) {
      const isRecorded = recorded.includes(file.filename);
      const target = file.target;

      if (!target) {
        if (!isRecorded) {
          toExecute.push({ ...file, reason: 'PENDING' });
        }
        continue;
      }

      if (target.type === 'TABLE') {
        const tableExists = liveTables.includes(target.name.toUpperCase());
        if (!tableExists) {
          if (isRecorded) {
            logger.warn(
              `[MigrationRunner] INCONSISTENCY DETECTED: Migration "${file.filename}" is recorded in SCHEMA_MIGRATIONS, but target table "${target.name}" is MISSING in Snowflake. Queueing for safe repair.`
            );
            toExecute.push({ ...file, reason: 'REPAIR_MISSING_TABLE' });
          } else {
            toExecute.push({ ...file, reason: 'PENDING' });
          }
        } else if (!isRecorded) {
          // Table exists but not in registry: record it or re-run safely
          toExecute.push({ ...file, reason: 'RECORD_SCHEMA' });
        }
      } else {
        // DATABASE or SCHEMA migration
        if (!isRecorded) {
          toExecute.push({ ...file, reason: 'PENDING' });
        }
      }
    }

    return toExecute;
  }

  /**
   * Execute required migrations safely and idempotently against live Snowflake
   */
  async runMigrations() {
    logger.info('[MigrationRunner] Starting state-aware Snowflake migration run...');

    // 1. Ensure database context and tracking table
    await executor.execute('CREATE DATABASE IF NOT EXISTS EDUBRIDGE_ADAPTIVE');
    await executor.execute('USE DATABASE EDUBRIDGE_ADAPTIVE');
    await executor.execute('CREATE SCHEMA IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP');
    await executor.execute('USE SCHEMA EDUBRIDGE_ADAPTIVE.APP');
    await this.ensureTrackingTable();

    // 2. Evaluate migration state against live Snowflake schema
    const pendingList = await this.getPendingAndRepairMigrations();

    if (pendingList.length === 0) {
      logger.info('[MigrationRunner] All migrations are up to date and all target tables verified in Snowflake.');
      return {
        appliedCount: 0,
        pendingCount: 0,
        applied: []
      };
    }

    logger.info(`[MigrationRunner] Found ${pendingList.length} migration(s) to execute:`);
    for (const m of pendingList) {
      logger.info(`  - ${m.filename} [${m.reason}]`);
    }

    const applied = [];

    for (const migration of pendingList) {
      const startTime = Date.now();
      logger.info(`[MigrationRunner] Applying: ${migration.filename} (${migration.reason})`);

      const content = fs.readFileSync(migration.fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      try {
        // Execute DDL statement(s) sequentially and await completion
        await executor.executeScript(content);

        const executionTime = Date.now() - startTime;

        // Upsert into SCHEMA_MIGRATIONS tracking registry
        const mergeSql = `
          MERGE INTO EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS AS target
          USING (
            SELECT ? AS migration_file, ? AS checksum, ? AS execution_time_ms, 'SUCCESS' AS status
          ) AS source
          ON target.migration_file = source.migration_file
          WHEN MATCHED THEN
            UPDATE SET applied_at = CURRENT_TIMESTAMP(), checksum = source.checksum, execution_time_ms = source.execution_time_ms, status = 'SUCCESS'
          WHEN NOT MATCHED THEN
            INSERT (migration_file, applied_at, checksum, execution_time_ms, status)
            VALUES (source.migration_file, CURRENT_TIMESTAMP(), source.checksum, source.execution_time_ms, 'SUCCESS')
        `;
        await executor.execute(mergeSql, [migration.filename, checksum, executionTime]);

        // If target is a table, verify immediately that it now exists in live Snowflake
        if (migration.target && migration.target.type === 'TABLE') {
          const checkRows = await executor.query(
            "SELECT TABLE_NAME FROM EDUBRIDGE_ADAPTIVE.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'APP' AND TABLE_NAME = ?",
            [migration.target.name.toUpperCase()]
          );
          if (!checkRows || checkRows.length === 0) {
            throw new Error(`DDL completed but table "${migration.target.name}" was not found in EDUBRIDGE_ADAPTIVE.APP`);
          }
        }

        logger.info(`[MigrationRunner] Successfully applied: ${migration.filename} (${executionTime}ms)`);
        applied.push({
          file: migration.filename,
          executionTimeMs: executionTime,
          status: 'SUCCESS',
          reason: migration.reason
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(`[MigrationRunner] Migration FAILED: ${migration.filename}`, {
          operation: 'DDL_EXECUTION',
          errorCode: error.code,
          errorMessage: error.message,
          executionTimeMs: executionTime
        });

        throw new Error(`Migration ${migration.filename} failed during DDL execution: ${error.message}`);
      }
    }

    logger.info(`[MigrationRunner] Migration run complete. Successfully executed ${applied.length} migration(s).`);
    return {
      appliedCount: applied.length,
      pendingCount: 0,
      applied
    };
  }
}

const migrationRunner = new MigrationRunner();
module.exports = migrationRunner;
