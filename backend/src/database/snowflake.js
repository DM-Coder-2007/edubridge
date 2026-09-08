/**
 * EduBridge Adaptive - Primary Database Abstraction: Snowflake
 * Delegates directly to authoritative Snowflake connection and executor layer.
 */

const executor = require('./snowflake/executor');
const connectionManager = require('./snowflake/connection');

const VARIANT_COLUMNS = new Set([
  'ACCESSIBILITY_PREFERENCES',
  'AI_EVALUATION_METADATA',
  'ANSWERS_SUMMARY',
  'METADATA',
  'WAVEFORM_DATA',
  'DETAILS',
  'MASTERY_HISTORY',
  'INTERACTION_HISTORY',
  'AI_GENERATION_METADATA',
  'KEY_TAKEAWAYS',
  'SENSORY_ANALOGIES',
  'STRUCTURED_CONTENT',
  'ADAPTIVE_RUBRIC',
  'OPTIONS',
  'AI_METADATA',
  'DIAGRAM_DESCRIPTIONS'
]);

class SnowflakeDB {
  isPrimary() {
    return true;
  }

  _qualifyTable(table) {
    if (!table) return table;
    const parts = table.split('.');
    if (parts.length === 1) {
      return `EDUBRIDGE_ADAPTIVE.APP.${parts[0].toUpperCase()}`;
    }
    if (parts.length === 2) {
      return `EDUBRIDGE_ADAPTIVE.${parts[0].toUpperCase()}.${parts[1].toUpperCase()}`;
    }
    return parts.map(p => p.toUpperCase()).join('.');
  }

  _qualifySql(sql) {
    if (!sql || typeof sql !== 'string') return sql;
    const knownTables = [
      'USERS',
      'TEXTBOOK_ASSETS',
      'LESSONS',
      'CONCEPTS',
      'QUESTIONS',
      'ATTEMPTS',
      'CONCEPT_MASTERY',
      'AUDIO_ASSETS',
      'LEARNING_SESSIONS',
      'AUDIT_LOGS',
      'SCHEMA_MIGRATIONS'
    ];
    let qualified = sql;
    for (const tbl of knownTables) {
      const regex = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE|TABLE)\\s+((?:EDUBRIDGE_ADAPTIVE\\.)?(?:APP\\.)?)(["]?${tbl}["]?)\\b`, 'gi');
      qualified = qualified.replace(regex, (match, clause, prefix) => {
        if (prefix.toUpperCase() === 'EDUBRIDGE_ADAPTIVE.APP.') {
          return match;
        }
        return `${clause} EDUBRIDGE_ADAPTIVE.APP.${tbl}`;
      });
    }
    return qualified;
  }

  _sanitizeBinds(binds) {
    if (!Array.isArray(binds)) return [];
    return binds.map(b => (b === undefined ? null : b));
  }

  async query(sql, binds = []) {
    return executor.query(this._qualifySql(sql), this._sanitizeBinds(binds));
  }

  async queryOne(sql, binds = []) {
    return executor.queryOne(this._qualifySql(sql), this._sanitizeBinds(binds));
  }

  async execute(sql, binds = []) {
    return executor.execute(this._qualifySql(sql), this._sanitizeBinds(binds));
  }

  async insert(table, data) {
    const qualifiedTable = this._qualifyTable(table);
    const keys = Object.keys(data);
    const columns = keys.map(k => k.toUpperCase()).join(', ');
    const expressions = keys.map(k => {
      const col = k.toUpperCase();
      if (VARIANT_COLUMNS.has(col)) {
        return 'PARSE_JSON(?)';
      }
      return '?';
    }).join(', ');

    const binds = keys.map(k => {
      const col = k.toUpperCase();
      const val = data[k];
      if (val === undefined || val === null) return null;
      if (VARIANT_COLUMNS.has(col)) {
        if (typeof val === 'string') {
          try {
            JSON.parse(val);
            return val;
          } catch {
            return JSON.stringify(val);
          }
        }
        return JSON.stringify(val);
      }
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });

    const sql = `INSERT INTO ${qualifiedTable} (${columns}) SELECT ${expressions}`;
    await this.query(sql, binds);
    return data;
  }

  async update(table, data, whereClause, whereBinds = []) {
    const qualifiedTable = this._qualifyTable(table);
    const keys = Object.keys(data);
    const setClause = keys.map(k => {
      const col = k.toUpperCase();
      if (VARIANT_COLUMNS.has(col)) {
        return `${col} = PARSE_JSON(?)`;
      }
      return `${col} = ?`;
    }).join(', ');

    const binds = keys.map(k => {
      const col = k.toUpperCase();
      const val = data[k];
      if (val === undefined || val === null) return null;
      if (VARIANT_COLUMNS.has(col)) {
        if (typeof val === 'string') {
          try {
            JSON.parse(val);
            return val;
          } catch {
            return JSON.stringify(val);
          }
        }
        return JSON.stringify(val);
      }
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    }).concat((whereBinds || []).map(b => (b === undefined ? null : b)));

    const hasUpdatedAt = keys.some(k => k.toUpperCase() === 'UPDATED_AT');
    const updatedAtClause = hasUpdatedAt ? '' : ', UPDATED_AT = CURRENT_TIMESTAMP()';
    const sql = `UPDATE ${qualifiedTable} SET ${setClause}${updatedAtClause} WHERE ${whereClause}`;
    return this.query(sql, binds);
  }

  async ping() {
    const connStatus = await connectionManager.testConnection();
    return {
      status: connStatus.connected ? 'OK' : 'ERROR',
      available: connStatus.connected,
      connected: connStatus.connected,
      primary: true,
      mode: 'LIVE_SNOWFLAKE',
      latencyMs: connStatus.latencyMs || 0
    };
  }

  async healthCheck() {
    return this.ping();
  }
}

const db = new SnowflakeDB();
module.exports = db;
