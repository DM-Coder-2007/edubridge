/**
 * CLI Command: npm run db:migrate
 * Executes pending Snowflake migrations.
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
    const report = await databaseManager.runMigrations();
    logger.info('[CLI db:migrate] Migration run completed:', {
      appliedCount: report.appliedCount,
      pendingCount: report.pendingCount
    });
    await databaseManager.closeConnection();
    process.exit(0);
  } catch (error) {
    logger.error('[CLI db:migrate] Migration execution failed:', { error: error.message });
    try {
      await databaseManager.closeConnection();
    } catch {}
    process.exit(1);
  }
}

main();
