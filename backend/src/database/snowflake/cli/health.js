const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Robust multi-path .env resolution
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const databaseManager = require('../databaseManager');
const connectionManager = require('../connection');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.getDatabaseHealth();
    if (report.status === 'unhealthy') {
      logger.error('[CLI db:health] Database health check reported UNHEALTHY:', {
        status: report.status,
        error: report.error
      });
      await connectionManager.destroyConnection().catch(() => {});
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

    await connectionManager.destroyConnection().catch(() => {});
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:health] Database health check failed:', { error: error.message });
    await connectionManager.destroyConnection().catch(() => {});
    process.exit(1);
  }
}

main();

