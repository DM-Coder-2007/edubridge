/**
 * CLI Command: npm run db:init
 * Idempotently initializes Snowflake database, schema, migrations, and tables.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables reliably
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const databaseManager = require('../databaseManager');
const logger = require('../../../utils/logger');

async function main() {
  try {
    const report = await databaseManager.initializeDatabase();
    logger.info('[CLI db:init] Database initialized successfully:', {
      database: report.database,
      schema: report.schema,
      mandatoryTablesCount: report.verification.mandatoryFound.length,
      actualTables: report.verification.actualTables
    });
    await databaseManager.closeConnection();
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:init] Failed to initialize Snowflake:', { error: error.message });
    try {
      await databaseManager.closeConnection();
    } catch {}
    process.exit(1);
  }
}

main();
