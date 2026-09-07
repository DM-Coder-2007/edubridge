/**
 * CLI Command: npm run db:init
 * Idempotently initializes Snowflake database, schema, and tables.
 */

const databaseManager = require('../databaseManager');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.initializeDatabase();
    logger.info('[CLI db:init] Database initialized successfully:', {
      database: report.database,
      schema: report.schema,
      tablesCount: report.verification.tablesFound.length
    });
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:init] Failed to initialize Snowflake:', { error: error.message });
    process.exit(1);
  }
}

main();
