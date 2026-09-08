/**
 * CLI Command: npm run db:verify
 * Validates live Snowflake database, APP schema, all 10 mandatory tables, and columns.
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
  console.log('\n===============================================================');
  console.log('            Snowflake Database Verification');
  console.log('===============================================================');

  try {
    const report = await databaseManager.verifySchema();

    console.log(`Account:  ${report.account || 'N/A'}`);
    console.log(`Region:   ${report.region || 'N/A'}`);
    console.log(`User:     ${report.user || 'N/A'}`);
    console.log(`Role:     ${report.role || 'N/A'}`);
    console.log(`Warehouse:${report.warehouse || 'N/A'}`);
    console.log(`Database: ${report.database}`);
    console.log(`Schema:   ${report.schema}`);
    console.log('---------------------------------------------------------------');
    console.log(`Expected tables: ${report.expectedTables.length}`);
    console.log(`Found tables:    ${report.mandatoryFound.length}`);
    console.log(`Missing tables:  ${report.missingTables.length}`);
    console.log('---------------------------------------------------------------');

    for (const table of report.expectedTables) {
      const exists = report.actualTables.includes(table);
      const icon = exists ? '[OK]' : '[MISSING]';
      const colStatus = report.missingColumns && report.missingColumns[table]
        ? `(Missing columns: ${report.missingColumns[table].join(', ')})`
        : '(All columns verified)';
      console.log(` ${icon} ${table.padEnd(20)} ${exists ? colStatus : ''}`);
    }

    if (report.unexpectedTables && report.unexpectedTables.length > 0) {
      console.log('\nAdditional Tables in Schema:');
      for (const t of report.unexpectedTables) {
        console.log(` [INFO] ${t}`);
      }
    }

    console.log('===============================================================');

    if (!report.isValid) {
      console.error('\nDatabase verification FAILED.');
      if (report.missingTables.length > 0) {
        console.error('\nMissing Mandatory Tables:');
        for (const t of report.missingTables) {
          console.error(` - ${t}`);
        }
      }
      if (report.errors.length > 0) {
        console.error('\nVerification Errors:');
        for (const err of report.errors) {
          console.error(` - ${err}`);
        }
      }
      console.log('===============================================================\n');
      await databaseManager.closeConnection();
      process.exit(1);
    }

    console.log('\nDatabase verification successful. All mandatory tables & columns intact.\n');
    await databaseManager.closeConnection();
    process.exit(0);
  } catch (error) {
    console.error('\nDatabase verification FAILED with exception:', error.message);
    console.log('===============================================================\n');
    try {
      await databaseManager.closeConnection();
    } catch {}
    process.exit(1);
  }
}

main();
