/**
 * EduBridge Adaptive - Snowflake Database Migration Runner
 */

const fs = require('fs');
const path = require('path');
const db = require('./snowflake');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('=======================================================');
  logger.info('Starting Snowflake Schema Migration Runner...');
  logger.info('Snowflake is the PRIMARY and MANDATORY application database.');
  logger.info('=======================================================');

  // Check local migrations directory first, or fallback to database/snowflake
  let migrationFile = path.resolve(__dirname, 'migrations', '001_initial_schema.sql');
  if (!fs.existsSync(migrationFile)) {
    migrationFile = path.resolve(__dirname, '..', '..', '..', 'database', 'snowflake', '001_initial_schema.sql');
  }

  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');

  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
      const clean = stmt.replace(/--.*$/gm, '').trim();
      return clean.length > 0;
    });

  logger.info(`Found ${statements.length} SQL DDL statements to execute in Snowflake.`);

  for (let i = 0; i < statements.length; i++) {
    const rawStmt = statements[i];
    const match = rawStmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/i);
    const tableName = match ? match[1] : `Statement #${i + 1}`;

    logger.info(`[Migrate] Executing (${i + 1}/${statements.length}): ${tableName}`);
    try {
      await db.query(rawStmt);
      logger.info(`[Migrate] Successfully applied: ${tableName}`);
    } catch (err) {
      logger.error(`[Migrate] Failed executing ${tableName}:`, err.message);
      throw err;
    }
  }

  logger.info('All Snowflake migrations applied successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
