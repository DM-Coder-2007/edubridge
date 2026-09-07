/**
 * CLI Command: npm run db:migrate
 * Executes pending Snowflake migrations.
 */

const databaseManager = require('../databaseManager');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.runMigrations();
    logger.info('[CLI db:migrate] Migration run completed:', {
      appliedCount: report.appliedCount,
      pendingCount: report.pendingCount
    });
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:migrate] Migration execution failed:', { error: error.message });
    process.exit(1);
  }
}

main();
