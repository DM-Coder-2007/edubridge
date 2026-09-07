/**
 * CLI Command: npm run db:verify
 * Validates Snowflake database, APP schema, all 10 mandatory tables, and columns.
 */

const databaseManager = require('../databaseManager');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.verifySchema();
    if (!report.isValid) {
      logger.error('[CLI db:verify] Verification FAILED:', { errors: report.errors });
      process.exit(1);
    }

    logger.info('[CLI db:verify] Schema verified successfully. All mandatory tables and columns intact:', {
      database: report.database,
      schema: report.schema,
      tablesFound: report.tablesFound
    });
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:verify] Error executing schema verification:', { error: error.message });
    process.exit(1);
  }
}

main();
