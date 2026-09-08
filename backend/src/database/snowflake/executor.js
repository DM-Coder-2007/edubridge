/**
 * EduBridge Adaptive - Snowflake Query & Statement Executor
 *
 * Provides safe parameterized query execution and multi-statement script execution
 * directly against the live Snowflake SDK connection.
 * Every statement is strictly awaited until Snowflake returns completion.
 */

const connectionManager = require('./connection');
const logger = require('../../utils/logger');

class SnowflakeExecutor {
  /**
   * Execute single SQL statement with optional binds
   * @param {string} sqlText
   * @param {Array} [binds=[]]
   * @returns {Promise<Array>}
   */
  async execute(sqlText, binds = []) {
    if (!sqlText || typeof sqlText !== 'string') {
      throw new Error('SQL statement must be a non-empty string');
    }

    const trimmed = sqlText.trim();
    if (!trimmed) {
      return [];
    }

    const conn = await connectionManager.getConnection();
    if (!conn || typeof conn.execute !== 'function') {
      const err = new Error('Snowflake connection error: conn.execute is not a function');
      err.category = 'CONNECTION_FAILURE';
      err.isConnectionError = true;
      throw err;
    }

    const startTime = Date.now();
    // Parse table and operation for structured diagnostics
    const opMatch = trimmed.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SHOW|USE|MERGE)\b/i);
    const operation = opMatch ? opMatch[1].toUpperCase() : 'QUERY';
    const tableMatch = trimmed.match(/(?:FROM|INTO|UPDATE|TABLE)\s+([A-Za-z0-9_.$]+)/i);
    const tableTarget = tableMatch ? tableMatch[1].replace(/["']/g, '') : 'UNKNOWN';

    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: trimmed,
        binds,
        complete: (err, stmt, rows) => {
          const durationMs = Date.now() - startTime;
          if (err) {
            // Classify Snowflake error
            const errMsg = err.message || '';
            const errCode = String(err.code || '');
            let category = 'APPLICATION_LOGIC_ERROR';
            let isTableMissing = false;
            let isPermissionDenied = false;
            let isSyntaxError = false;
            let isInvalidIdentifier = false;
            let isTimeout = false;
            let isConnectionError = false;

            if (errCode === '002003' && errMsg.includes('does not exist')) {
              category = 'TABLE_MISSING';
              isTableMissing = true;
            } else if (errCode === '002003' && errMsg.includes('not authorized')) {
              category = 'PERMISSION_DENIED';
              isPermissionDenied = true;
            } else if (errCode === '300001' || errMsg.toLowerCase().includes('not authorized') || errMsg.toLowerCase().includes('access denied')) {
              category = 'PERMISSION_DENIED';
              isPermissionDenied = true;
            } else if (errCode === '001003' || errMsg.includes('syntax error')) {
              category = 'SQL_SYNTAX_ERROR';
              isSyntaxError = true;
            } else if (errCode === '000904' || errMsg.includes('invalid identifier')) {
              category = 'INVALID_IDENTIFIER';
              isInvalidIdentifier = true;
            } else if (errMsg.toLowerCase().includes('timeout') || errCode === 'TIMEOUT') {
              category = 'TIMEOUT';
              isTimeout = true;
            } else if (errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('network') || errCode === 'CONNECTION_ERROR') {
              category = 'CONNECTION_FAILURE';
              isConnectionError = true;
            }

            // Structured internal diagnostic log (never logging credentials)
            logger.error(`[SnowflakeQueryError] operation=${operation} database=EDUBRIDGE_ADAPTIVE schema=APP table=${tableTarget} category=${category} errorCode=${errCode} durationMs=${durationMs} message=${errMsg}`);

            // Enrich error object
            err.category = category;
            err.isTableMissing = isTableMissing;
            err.isPermissionDenied = isPermissionDenied;
            err.isSyntaxError = isSyntaxError;
            err.isInvalidIdentifier = isInvalidIdentifier;
            err.isTimeout = isTimeout;
            err.isConnectionError = isConnectionError;
            err.durationMs = durationMs;
            err.table = tableTarget;
            err.operation = operation;

            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      });
    });
  }

  /**
   * Alias for execute
   */
  async query(sqlText, binds = []) {
    return this.execute(sqlText, binds);
  }

  /**
   * Execute query and return single row or null
   */
  async queryOne(sqlText, binds = []) {
    const rows = await this.execute(sqlText, binds);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a multi-statement SQL script sequentially and await each statement
   * @param {string} scriptText
   * @returns {Promise<Array<{ statement: string, rows: Array }>>}
   */
  async executeScript(scriptText) {
    if (!scriptText || typeof scriptText !== 'string') {
      throw new Error('Script text must be a valid non-empty string');
    }

    // Strip multiline comments /* ... */
    let sanitized = scriptText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split on semicolons while ignoring comments
    const rawStatements = sanitized.split(';');

    const statements = [];
    for (const raw of rawStatements) {
      // Strip single line comments (-- ...)
      const clean = raw.replace(/--.*$/gm, '').trim();
      if (clean.length > 0) {
        statements.push(clean);
      }
    }

    const results = [];
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        const rows = await this.execute(stmt);
        results.push({ statement: stmt, rows });
      } catch (err) {
        logger.error(`[SnowflakeExecutor] Script statement ${i + 1}/${statements.length} failed:`, {
          statement: stmt.substring(0, 200),
          code: err.code,
          error: err.message
        });
        throw new Error(`Statement ${i + 1}/${statements.length} failed: ${err.message} (SQL: ${stmt.substring(0, 120)})`);
      }
    }

    return results;
  }
}

const executor = new SnowflakeExecutor();
module.exports = executor;
