/**
 * EduBridge Adaptive - Primary Database Abstraction: Snowflake
 * Delegates directly to authoritative Snowflake connection and executor layer.
 */

const executor = require('./snowflake/executor');
const connectionManager = require('./snowflake/connection');

class SnowflakeDB {
  isPrimary() {
    return true;
  }

  async query(sql, binds = []) {
    return executor.query(sql, binds);
  }

  async queryOne(sql, binds = []) {
    return executor.queryOne(sql, binds);
  }

  async execute(sql, binds = []) {
    return executor.execute(sql, binds);
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const columns = keys.map(k => k.toUpperCase()).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const binds = keys.map(k => {
      const val = data[k];
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    await this.query(sql, binds);
    return data;
  }

  async update(table, data, whereClause, whereBinds = []) {
    const keys = Object.keys(data);
    const setClause = keys.map(k => `${k.toUpperCase()} = ?`).join(', ');
    const binds = keys.map(k => {
      const val = data[k];
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    }).concat(whereBinds);

    const sql = `UPDATE ${table} SET ${setClause}, UPDATED_AT = CURRENT_TIMESTAMP() WHERE ${whereClause}`;
    return this.query(sql, binds);
  }

  async ping() {
    const connStatus = await connectionManager.testConnection();
    return {
      status: 'OK',
      available: true,
      connected: connStatus.connected,
      primary: true,
      mode: connStatus.mode || 'MOCK_EMULATION',
      latencyMs: connStatus.latencyMs || 1
    };
  }

  async healthCheck() {
    return this.ping();
  }
}

const db = new SnowflakeDB();
module.exports = db;
