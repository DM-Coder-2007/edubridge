/**
 * EduBridge Adaptive - Snowflake Configuration Delegate
 */
const db = require('../database/snowflake');
const connectionManager = require('../database/snowflake/connection');

module.exports = {
  isPrimary: () => true,
  execute: (sqlText, binds) => db.execute(sqlText, binds),
  ping: () => db.ping(),
  get isMock() { return connectionManager.isMockMode(); }
};
