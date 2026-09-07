/**
 * EduBridge Adaptive - Snowflake Query & Statement Executor
 *
 * Provides safe parameterized query execution, multi-statement script execution,
 * and high-fidelity mock simulation for automated testing and local development.
 */

const connectionManager = require('./connection');
const logger = require('../../utils/logger');

class SnowflakeExecutor {
  /**
   * Execute single SQL statement with binds
   * @param {string} sqlText
   * @param {Array} [binds=[]]
   * @returns {Promise<Array>}
   */
  async execute(sqlText, binds = []) {
    if (!sqlText || typeof sqlText !== 'string') {
      throw new Error('SQL statement must be a non-empty string');
    }

    if (connectionManager.isMockMode()) {
      return this._executeMock(sqlText, binds);
    }

    const conn = await connectionManager.getConnection();
    if (!conn || conn.mock || connectionManager.isMockMode() || typeof conn.execute !== 'function') {
      return this._executeMock(sqlText, binds);
    }

    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) {
            logger.error('[SnowflakeExecutor] Query execution failed:', {
              sql: sqlText.substring(0, 200),
              error: err.message
            });
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      });
    });
  }

  async query(sqlText, binds = []) {
    return this.execute(sqlText, binds);
  }

  async queryOne(sqlText, binds = []) {
    const rows = await this.execute(sqlText, binds);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a multi-statement SQL script (e.g. from migration files)
   * @param {string} scriptText
   * @returns {Promise<Array<{ statement: string, rows: Array }>>}
   */
  async executeScript(scriptText) {
    if (!scriptText || typeof scriptText !== 'string') {
      throw new Error('Script text must be a valid non-empty string');
    }

    // Split on semicolons while ignoring semicolons inside strings or comments
    const statements = scriptText
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Strip out single-line comments
        const clean = stmt.replace(/--.*$/gm, '').trim();
        return clean.length > 0;
      });

    const results = [];
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        const rows = await this.execute(stmt);
        results.push({ statement: stmt, rows });
      } catch (err) {
        logger.error(`[SnowflakeExecutor] Script statement ${i + 1}/${statements.length} failed:`, {
          statement: stmt.substring(0, 150),
          error: err.message
        });
        throw new Error(`Statement execution failed in script (${err.message}): ${stmt.substring(0, 100)}`);
      }
    }

    return results;
  }

  /**
   * High-fidelity in-memory SQL mock engine
   * @private
   */
  async _executeMock(sqlText, binds = []) {
    const cleanSql = sqlText.replace(/--.*$/gm, '').trim();
    const upper = cleanSql.toUpperCase();
    const store = connectionManager.getMockStore();

    // Ensure store structure
    if (!store.databases) store.databases = {};

    // 1. USE DATABASE / USE SCHEMA
    if (upper.startsWith('USE DATABASE')) {
      const match = cleanSql.match(/USE\s+DATABASE\s+([A-Za-z0-9_]+)/i);
      if (match) {
        const dbName = match[1].toUpperCase();
        connectionManager.setCurrentDatabase(dbName);
        return [{ status: `Statement executed successfully. Using database ${dbName}` }];
      }
    }

    if (upper.startsWith('USE SCHEMA') || upper.startsWith('USE')) {
      const match = cleanSql.match(/USE\s+SCHEMA\s+([A-Za-z0-9_.]+)/i) || cleanSql.match(/USE\s+([A-Za-z0-9_.]+)/i);
      if (match) {
        const full = match[1].toUpperCase();
        if (full.includes('.')) {
          const [dbPart, schPart] = full.split('.');
          connectionManager.setCurrentDatabase(dbPart);
          connectionManager.setCurrentSchema(schPart);
        } else {
          connectionManager.setCurrentSchema(full);
        }
        return [{ status: `Statement executed successfully. Using schema ${full}` }];
      }
    }

    // 2. CREATE DATABASE IF NOT EXISTS
    if (upper.startsWith('CREATE DATABASE')) {
      const match = cleanSql.match(/CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/i);
      if (match) {
        const dbName = match[1].toUpperCase();
        if (!store.databases[dbName]) {
          store.databases[dbName] = { schemas: { 'PUBLIC': { tables: {} } } };
          connectionManager.saveMockStore();
          return [{ status: `Database ${dbName} successfully created.` }];
        }
        return [{ status: `Database ${dbName} already exists, statement succeeded.` }];
      }
    }

    // 3. CREATE SCHEMA IF NOT EXISTS
    if (upper.startsWith('CREATE SCHEMA')) {
      const match = cleanSql.match(/CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.]+)/i);
      if (match) {
        const rawName = match[1].toUpperCase();
        let targetDb = connectionManager.getCurrentDatabase();
        let schemaName = rawName;

        if (rawName.includes('.')) {
          const parts = rawName.split('.');
          targetDb = parts[0];
          schemaName = parts[1];
        }

        if (!store.databases[targetDb]) {
          store.databases[targetDb] = { schemas: {} };
        }
        if (!store.databases[targetDb].schemas[schemaName]) {
          store.databases[targetDb].schemas[schemaName] = { tables: {} };
          connectionManager.saveMockStore();
          return [{ status: `Schema ${schemaName} successfully created.` }];
        }
        return [{ status: `Schema ${schemaName} already exists, statement succeeded.` }];
      }
    }

    // 4. CREATE TABLE IF NOT EXISTS
    if (upper.startsWith('CREATE TABLE')) {
      const match = cleanSql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.]+)\s*\(([\s\S]+)\)/i);
      if (match) {
        const fullTableName = match[1].toUpperCase();
        const columnDefinitions = match[2];

        let targetDb = connectionManager.getCurrentDatabase();
        let targetSchema = connectionManager.getCurrentSchema();
        let tableName = fullTableName;

        if (fullTableName.includes('.')) {
          const parts = fullTableName.split('.');
          if (parts.length === 3) {
            targetDb = parts[0];
            targetSchema = parts[1];
            tableName = parts[2];
          } else if (parts.length === 2) {
            targetSchema = parts[0];
            tableName = parts[1];
          }
        }

        // Parse column names
        const columns = [];
        const lines = columnDefinitions.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim().replace(/,$/, '');
          if (!trimmedLine || trimmedLine.startsWith('--') || trimmedLine.startsWith('COMMENT') || trimmedLine.startsWith('PRIMARY KEY') || trimmedLine.startsWith('CONSTRAINT') || trimmedLine.startsWith('CLUSTER BY') || trimmedLine.startsWith('UNIQUE') || trimmedLine.startsWith('FOREIGN KEY')) {
            continue;
          }
          const colMatch = trimmedLine.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+(?:\s*\([^)]+\))?)/i);
          if (colMatch) {
            columns.push({
              name: colMatch[1].toUpperCase(),
              type: colMatch[2].toUpperCase().replace(/\s+/g, '')
            });
          }
        }

        if (!store.databases[targetDb]) store.databases[targetDb] = { schemas: {} };
        if (!store.databases[targetDb].schemas[targetSchema]) store.databases[targetDb].schemas[targetSchema] = { tables: {} };

        const tablesObj = store.databases[targetDb].schemas[targetSchema].tables;

        // Idempotent: do not overwrite existing table data!
        if (!tablesObj[tableName]) {
          tablesObj[tableName] = {
            name: tableName,
            columns,
            rows: []
          };
          connectionManager.saveMockStore();
          return [{ status: `Table ${tableName} successfully created.` }];
        } else {
          // Merge any new columns that might have been added to the DDL
          const existingColNames = (tablesObj[tableName].columns || []).map(c => c.name);
          for (const col of columns) {
            if (!existingColNames.includes(col.name)) {
              tablesObj[tableName].columns.push(col);
            }
          }
          connectionManager.saveMockStore();
        }
        return [{ status: `Table ${tableName} already exists, statement succeeded.` }];
      }
    }

    // 5. SHOW DATABASES
    if (upper.startsWith('SHOW DATABASES')) {
      return Object.keys(store.databases).map(name => ({
        name,
        created_on: new Date().toISOString()
      }));
    }

    // 6. SHOW SCHEMAS
    if (upper.startsWith('SHOW SCHEMAS')) {
      const dbMatch = cleanSql.match(/SHOW\s+SCHEMAS\s+(?:IN\s+DATABASE\s+([A-Za-z0-9_]+))?/i);
      const targetDb = (dbMatch && dbMatch[1]) ? dbMatch[1].toUpperCase() : connectionManager.getCurrentDatabase();
      const schemas = (store.databases[targetDb] && store.databases[targetDb].schemas) ? store.databases[targetDb].schemas : {};
      return Object.keys(schemas).map(name => ({
        name,
        database_name: targetDb
      }));
    }

    // 7. SHOW TABLES
    if (upper.startsWith('SHOW TABLES')) {
      const match = cleanSql.match(/SHOW\s+TABLES\s+(?:IN\s+SCHEMA\s+([A-Za-z0-9_.]+))?/i);
      let targetDb = connectionManager.getCurrentDatabase();
      let targetSchema = connectionManager.getCurrentSchema();

      if (match && match[1]) {
        const full = match[1].toUpperCase();
        if (full.includes('.')) {
          const parts = full.split('.');
          targetDb = parts[0];
          targetSchema = parts[1];
        } else {
          targetSchema = full;
        }
      }

      const tables = (store.databases[targetDb] && store.databases[targetDb].schemas[targetSchema])
        ? store.databases[targetDb].schemas[targetSchema].tables
        : {};

      return Object.keys(tables).map(tableName => ({
        name: tableName,
        database_name: targetDb,
        schema_name: targetSchema,
        rows: tables[tableName].rows.length
      }));
    }

    // 8. DESCRIBE TABLE / SHOW COLUMNS
    if (upper.startsWith('DESCRIBE TABLE') || upper.startsWith('DESC TABLE') || upper.startsWith('SHOW COLUMNS')) {
      const match = cleanSql.match(/(?:DESCRIBE\s+TABLE|DESC\s+TABLE|SHOW\s+COLUMNS\s+IN\s+TABLE)\s+([A-Za-z0-9_.]+)/i);
      if (match) {
        const full = match[1].toUpperCase();
        let targetDb = connectionManager.getCurrentDatabase();
        let targetSchema = connectionManager.getCurrentSchema();
        let tableName = full;

        if (full.includes('.')) {
          const parts = full.split('.');
          if (parts.length === 3) {
            targetDb = parts[0];
            targetSchema = parts[1];
            tableName = parts[2];
          } else if (parts.length === 2) {
            targetSchema = parts[0];
            tableName = parts[1];
          }
        }

        const table = (store.databases[targetDb] && store.databases[targetDb].schemas[targetSchema])
          ? store.databases[targetDb].schemas[targetSchema].tables[tableName]
          : null;

        if (!table) return [];

        return table.columns.map(c => ({
          name: c.name,
          type: c.type,
          null: 'Y',
          default: null
        }));
      }
    }

    // 9. SELECT
    if (upper.startsWith('SELECT')) {
      if (upper.includes('CURRENT_DATABASE()') || upper.includes('CURRENT_SCHEMA()') || upper.includes('CURRENT_USER()') || upper.includes('SELECT 1')) {
        return [{
          DB: connectionManager.getCurrentDatabase(),
          SCH: connectionManager.getCurrentSchema(),
          WH: 'COMPUTE_WH',
          USER: 'SNOWFLAKE_ADMIN',
          PING: 1,
          'CURRENT_DATABASE()': connectionManager.getCurrentDatabase(),
          'CURRENT_SCHEMA()': connectionManager.getCurrentSchema(),
          'CURRENT_USER()': 'SNOWFLAKE_ADMIN'
        }];
      }

      const fromMatch = cleanSql.match(/FROM\s+([A-Za-z0-9_.]+)/i);
      if (!fromMatch) return [];

      const full = fromMatch[1].toUpperCase();
      let targetDb = connectionManager.getCurrentDatabase();
      let targetSchema = connectionManager.getCurrentSchema();
      let tableName = full;

      if (full.includes('.')) {
        const parts = full.split('.');
        if (parts.length === 3) {
          targetDb = parts[0];
          targetSchema = parts[1];
          tableName = parts[2];
        } else if (parts.length === 2) {
          targetSchema = parts[0];
          tableName = parts[1];
        }
      }

      const table = (store.databases[targetDb] && store.databases[targetDb].schemas[targetSchema])
        ? store.databases[targetDb].schemas[targetSchema].tables[tableName]
        : null;

      if (!table) return [];

      let rows = [...table.rows];

      // Handle WHERE
      if (upper.includes('WHERE')) {
        const wherePart = cleanSql.split(/WHERE/i)[1].split(/ORDER\s+BY|LIMIT/i)[0].trim();
        const conditions = wherePart.split(/\s+AND\s+/i);
        let bindIdx = 0;
        for (const cond of conditions) {
          const eqMatch = cond.match(/([A-Za-z0-9_]+)\s*=\s*(\?|'[^']*'|[0-9]+)/i);
          if (eqMatch) {
            const col = eqMatch[1].toUpperCase();
            let targetVal = eqMatch[2];
            if (targetVal === '?') {
              targetVal = binds[bindIdx++];
            } else if (targetVal.startsWith("'")) {
              targetVal = targetVal.replace(/'/g, '');
            }
            rows = rows.filter(r => {
              const val = r[col];
              if (val === undefined || val === null) return false;
              return String(val).toLowerCase() === String(targetVal).toLowerCase();
            });
          }
        }
      }

      // Handle COUNT(*)
      if (upper.includes('COUNT(*)')) {
        return [{ 'COUNT(*)': rows.length, count: rows.length, COUNT: rows.length }];
      }

      return rows;
    }

    // 10. INSERT INTO
    if (upper.startsWith('INSERT INTO')) {
      const match = cleanSql.match(/INSERT\s+INTO\s+([A-Za-z0-9_.]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const full = match[1].toUpperCase();
        let targetDb = connectionManager.getCurrentDatabase();
        let targetSchema = connectionManager.getCurrentSchema();
        let tableName = full;

        if (full.includes('.')) {
          const parts = full.split('.');
          if (parts.length === 3) {
            targetDb = parts[0];
            targetSchema = parts[1];
            tableName = parts[2];
          } else if (parts.length === 2) {
            targetSchema = parts[0];
            tableName = parts[1];
          }
        }

        if (!store.databases[targetDb]) store.databases[targetDb] = { schemas: {} };
        if (!store.databases[targetDb].schemas[targetSchema]) store.databases[targetDb].schemas[targetSchema] = { tables: {} };
        if (!store.databases[targetDb].schemas[targetSchema].tables[tableName]) {
          store.databases[targetDb].schemas[targetSchema].tables[tableName] = { name: tableName, columns: [], rows: [] };
        }

        const table = store.databases[targetDb].schemas[targetSchema].tables[tableName];
        const cols = match[2] ? match[2].split(',').map(c => c.trim().toUpperCase()) : [];
        const row = {};

        if (cols.length > 0) {
          let bIdx = 0;
          cols.forEach(col => {
            row[col] = binds[bIdx++];
          });
        }

        table.rows.push(row);
        connectionManager.saveMockStore();
        return [{ number_of_rows_inserted: 1 }];
      }
    }

    // 11. UPDATE
    if (upper.startsWith('UPDATE')) {
      const match = cleanSql.match(/UPDATE\s+([A-Za-z0-9_.]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([A-Za-z0-9_]+)\s*=\s*(\?|'[^']*'|[0-9]+)/i);
      if (match) {
        const full = match[1].toUpperCase();
        let targetDb = connectionManager.getCurrentDatabase();
        let targetSchema = connectionManager.getCurrentSchema();
        let tableName = full;

        if (full.includes('.')) {
          const parts = full.split('.');
          if (parts.length === 3) {
            targetDb = parts[0];
            targetSchema = parts[1];
            tableName = parts[2];
          } else if (parts.length === 2) {
            targetSchema = parts[0];
            tableName = parts[1];
          }
        }

        const table = (store.databases[targetDb] && store.databases[targetDb].schemas[targetSchema])
          ? store.databases[targetDb].schemas[targetSchema].tables[tableName]
          : null;

        if (!table) return [{ number_of_rows_updated: 0 }];

        const setClause = match[2];
        const whereCol = match[3].toUpperCase();
        const whereTarget = match[4];

        let whereVal;
        let setBinds;
        if (whereTarget === '?') {
          whereVal = binds[binds.length - 1];
          setBinds = binds.slice(0, binds.length - 1);
        } else {
          whereVal = whereTarget.replace(/^'|'$/g, '');
          setBinds = binds;
        }

        const assignments = setClause.split(',').map(s => s.trim());
        let bindIdx = 0;
        let updatedCount = 0;

        table.rows = table.rows.map(row => {
          if (row[whereCol] == whereVal) {
            updatedCount++;
            assignments.forEach(asg => {
              const eqIdx = asg.indexOf('=');
              if (eqIdx !== -1) {
                const colName = asg.slice(0, eqIdx).trim().toUpperCase();
                const expr = asg.slice(eqIdx + 1).trim();
                if (expr === '?') {
                  row[colName] = setBinds[bindIdx++];
                } else if (expr.toUpperCase().includes('CURRENT_TIMESTAMP')) {
                  row[colName] = new Date().toISOString();
                } else {
                  row[colName] = expr.replace(/^'|'$/g, '');
                }
              }
            });
          }
          return row;
        });

        connectionManager.saveMockStore();
        return [{ number_of_rows_updated: updatedCount }];
      }
    }

    // 12. DELETE FROM
    if (upper.startsWith('DELETE FROM')) {
      const match = cleanSql.match(/DELETE\s+FROM\s+([A-Za-z0-9_.]+)\s+WHERE\s+([A-Za-z0-9_]+)\s*=\s*(\?|'[^']*'|[0-9]+)(?:\s+OR\s+([A-Za-z0-9_]+)\s*=\s*(\?|'[^']*'|[0-9]+))?/i);
      if (match) {
        const full = match[1].toUpperCase();
        let targetDb = connectionManager.getCurrentDatabase();
        let targetSchema = connectionManager.getCurrentSchema();
        let tableName = full;

        if (full.includes('.')) {
          const parts = full.split('.');
          if (parts.length === 3) {
            targetDb = parts[0];
            targetSchema = parts[1];
            tableName = parts[2];
          } else if (parts.length === 2) {
            targetSchema = parts[0];
            tableName = parts[1];
          }
        }

        const table = (store.databases[targetDb] && store.databases[targetDb].schemas[targetSchema])
          ? store.databases[targetDb].schemas[targetSchema].tables[tableName]
          : null;

        if (!table) return [{ number_of_rows_deleted: 0 }];

        const col1 = match[2].toUpperCase();
        let targetVal1 = match[3];
        let bIdx = 0;
        if (targetVal1 === '?') targetVal1 = binds[bIdx++];
        else if (targetVal1) targetVal1 = targetVal1.replace(/'/g, '');

        let col2 = match[4] ? match[4].toUpperCase() : null;
        let targetVal2 = match[5];
        if (col2 && targetVal2 === '?') targetVal2 = binds[bIdx++];
        else if (col2 && targetVal2) targetVal2 = targetVal2.replace(/'/g, '');

        const initialCount = table.rows.length;
        table.rows = table.rows.filter(r => {
          const match1 = String(r[col1] || '').toLowerCase() === String(targetVal1).toLowerCase();
          const match2 = col2 ? String(r[col2] || '').toLowerCase() === String(targetVal2).toLowerCase() : false;
          return !(match1 || match2);
        });

        const deletedCount = initialCount - table.rows.length;
        connectionManager.saveMockStore();
        return [{ number_of_rows_deleted: deletedCount }];
      }
    }

    return [];
  }
}

const executor = new SnowflakeExecutor();
module.exports = executor;
