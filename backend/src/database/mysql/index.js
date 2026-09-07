/**
 * EduBridge Adaptive - MySQL Module Export (Optional Secondary Adapter)
 *
 * ARCHITECTURAL STATEMENT:
 * "MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database."
 */

const mysqlConnection = require('./connection');
const { checkMySQLHealth } = require('./healthCheck');

module.exports = {
  mysqlConnection,
  checkMySQLHealth
};
