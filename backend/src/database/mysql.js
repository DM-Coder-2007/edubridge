/**
 * EduBridge Adaptive - MySQL Adapter (Backwards Compatibility Alias)
 *
 * ARCHITECTURAL STATEMENT:
 * "MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database."
 */

const { mysqlConnection, checkMySQLHealth } = require('./mysql');

class MySQLAdapter {
  constructor() {
    this.connection = mysqlConnection;
  }

  get isEnabled() {
    return mysqlConnection.isEnabled();
  }

  async query(sql, params = []) {
    return mysqlConnection.execute(sql, params);
  }

  async healthCheck() {
    return checkMySQLHealth();
  }
}

const mysqlAdapter = new MySQLAdapter();
module.exports = mysqlAdapter;
