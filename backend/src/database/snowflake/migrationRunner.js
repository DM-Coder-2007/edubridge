/**
 * EduBridge Adaptive - Snowflake Migration Runner
 *
 * Executes versioned DDL migrations safely and idempotently.
 * Tracks applied migrations in EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const executor = require('./executor');
const logger = require('../../utils/logger');

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
      fullPath: path.join(dir, file)
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
   * Retrieve list of successfully applied migrations
   */
  async getAppliedMigrations() {
    await this.ensureTrackingTable();
    try {
      const rows = await executor.query(
        'SELECT migration_file, applied_at, checksum, status FROM EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS WHERE status = ?',
        ['SUCCESS']
      );
      return rows.map(r => r.MIGRATION_FILE || r.migration_file);
    } catch {
      return [];
    }
  }

  /**
   * Get list of pending migrations yet to be applied
   */
  async getPendingMigrations() {
    const allFiles = this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();
    return allFiles.filter(f => !applied.includes(f.filename));
  }

  /**
   * Execute pending migrations safely and idempotently
   */
  async runMigrations() {
    logger.info('[MigrationRunner] Starting Snowflake migration run...');

    // 1. Ensure database and schema tracking table exist
    await executor.execute('CREATE DATABASE IF NOT EXISTS EDUBRIDGE_ADAPTIVE');
    await executor.execute('CREATE SCHEMA IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP');
    await this.ensureTrackingTable();

    const pending = await this.getPendingMigrations();
    if (pending.length === 0) {
      logger.info('[MigrationRunner] All migrations are up to date. No pending migrations.');
      return {
        appliedCount: 0,
        pendingCount: 0,
        applied: []
      };
    }

    logger.info(`[MigrationRunner] Found ${pending.length} pending migration(s) to apply.`);
    const applied = [];

    for (const migration of pending) {
      const startTime = Date.now();
      logger.info(`[MigrationRunner] Applying: ${migration.filename}`);

      const content = fs.readFileSync(migration.fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      try {
        await executor.executeScript(content);

        const executionTime = Date.now() - startTime;
        await executor.execute(
          `INSERT INTO EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS 
           (migration_file, checksum, execution_time_ms, status) 
           VALUES (?, ?, ?, ?)`,
          [migration.filename, checksum, executionTime, 'SUCCESS']
        );

        logger.info(`[MigrationRunner] Successfully applied: ${migration.filename} (${executionTime}ms)`);
        applied.push({
          file: migration.filename,
          executionTimeMs: executionTime,
          status: 'SUCCESS'
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(`[MigrationRunner] Migration FAILED: ${migration.filename}`, {
          error: error.message
        });

        throw new Error(`Migration ${migration.filename} failed: ${error.message}`);
      }
    }

    logger.info(`[MigrationRunner] Finished. Successfully applied ${applied.length} migration(s).`);
    return {
      appliedCount: applied.length,
      pendingCount: 0,
      applied
    };
  }
}

const migrationRunner = new MigrationRunner();
module.exports = migrationRunner;
