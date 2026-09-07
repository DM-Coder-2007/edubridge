/**
 * CLI Command: npm run db:health
 * Checks Snowflake connection, warehouse, database, and schema health.
 */

const databaseManager = require('../databaseManager');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.getDatabaseHealth();
    if (report.status === 'unhealthy') {
      logger.error('[CLI db:health] Database health check reported UNHEALTHY:', {
        status: report.status,
        error: report.error
      });
      process.exit(1);
    }

    logger.info('[CLI db:health] Snowflake database is healthy:', {
      service: 'snowflake',
      status: report.status,
      database: report.database,
      schema: report.schema,
      warehouse: report.warehouse,
      tablesCount: report.tablesCount,
      latencyMs: report.latencyMs
    });
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:health] Database health check failed:', { error: error.message });
    process.exit(1);
  }
}

main();
