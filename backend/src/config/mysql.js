/**
 * EduBridge Adaptive - Optional Secondary Database Configuration (MySQL)
 */

const config = require('./index');

module.exports = {
  enabled: config.mysql.enabled,
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database
};
