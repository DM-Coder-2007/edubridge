/**
 * EduBridge Adaptive - Snowflake Database Infrastructure Test Suite
 *
 * CRITICAL ARCHITECTURE RULE:
 * Snowflake is the PRIMARY and MANDATORY database.
 *
 * Verifies:
 * 1. Fresh database initialization.
 * 2. Run initialization a second time (idempotency).
 * 3. Verify no duplicate objects are created.
 * 4. Verify existing records remain intact.
 * 5. Simulate a partially-created database and rerun initialization.
 * 6. Verify schema validation (database, schema, tables, critical columns).
 * 7. Test connection failure handling.
 * 8. Test migration failure handling.
 */

const databaseManager = require('../../src/database/snowflake/databaseManager');
const connectionManager = require('../../src/database/snowflake/connection');
const executor = require('../../src/database/snowflake/executor');
const migrationRunner = require('../../src/database/snowflake/migrationRunner');

describe('Snowflake Database Infrastructure: EduBridge Adaptive', () => {
  beforeEach(() => {
    // Reset connection mock store before each test for clean isolation
    connectionManager.resetMockStore();
    connectionManager.setCurrentDatabase('EDUBRIDGE_ADAPTIVE');
    connectionManager.setCurrentSchema('APP');
  });

  afterAll(async () => {
    await databaseManager.closeConnection();
  });

  describe('1. Fresh Database Initialization', () => {
    it('should create EDUBRIDGE_ADAPTIVE database, APP schema, and all 10 mandatory tables', async () => {
      const report = await databaseManager.initializeDatabase();

      expect(report.success).toBe(true);
      expect(report.database).toBe('EDUBRIDGE_ADAPTIVE');
      expect(report.schema).toBe('APP');
      expect(report.migrationsApplied.length).toBe(12);

      // Verify all 10 mandatory tables were created
      expect(report.verification.isValid).toBe(true);
      expect(report.verification.missingTables).toEqual([]);
      expect(report.verification.tablesFound).toEqual(
        expect.arrayContaining([
          'USERS',
          'TEXTBOOK_ASSETS',
          'LESSONS',
          'CONCEPTS',
          'QUESTIONS',
          'ATTEMPTS',
          'CONCEPT_MASTERY',
          'AUDIO_ASSETS',
          'LEARNING_SESSIONS',
          'AUDIT_LOGS'
        ])
      );
    });
  });

  describe('2. Idempotency & 3. No Duplicate Objects', () => {
    it('running initialization a second time must succeed and create no duplicate objects', async () => {
      // First run
      const firstRun = await databaseManager.initializeDatabase();
      expect(firstRun.success).toBe(true);
      expect(firstRun.migrationsApplied.length).toBe(12);

      // Second run
      const secondRun = await databaseManager.initializeDatabase();
      expect(secondRun.success).toBe(true);
      expect(secondRun.migrationsApplied.length).toBe(0); // No pending migrations applied

      // Verify tables count remains exactly 11 (10 mandatory + 1 SCHEMA_MIGRATIONS)
      const tables = await executor.query('SHOW TABLES IN SCHEMA EDUBRIDGE_ADAPTIVE.APP');
      const tableNames = tables.map(t => t.name || t.NAME);

      expect(tableNames.length).toBe(11);
      expect(tableNames).toEqual(
        expect.arrayContaining([
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
        ])
      );
    });
  });

  describe('4. Data Preservation (Non-Destructive Initialization)', () => {
    it('should preserve existing user data across multiple initialization runs', async () => {
      await databaseManager.initializeDatabase();

      // Insert existing student record
      const testUser = {
        ID: 'usr-persisted-42',
        EMAIL: 'student.persisted@edubridge.org',
        PASSWORD_HASH: '$2a$10$abcdefghijklmnopqrstuv',
        FULL_NAME: 'Persistent Student',
        ROLE: 'student',
        ACCESSIBILITY_PREFERENCES: { screenReader: true, highContrast: true }
      };

      await databaseManager.insert('USERS', testUser);

      // Verify row exists
      const rowsBefore = await executor.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.USERS WHERE ID = ?',
        [testUser.ID]
      );
      expect(rowsBefore.length).toBe(1);
      expect(rowsBefore[0].EMAIL).toBe(testUser.EMAIL);

      // Run initialization again
      await databaseManager.initializeDatabase();

      // Verify row is still intact!
      const rowsAfter = await executor.query(
        'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.USERS WHERE ID = ?',
        [testUser.ID]
      );
      expect(rowsAfter.length).toBe(1);
      expect(rowsAfter[0].EMAIL).toBe(testUser.EMAIL);
      expect(rowsAfter[0].FULL_NAME).toBe('Persistent Student');
    });
  });

  describe('5. Partially-Created Database Simulation', () => {
    it('should detect missing tables in a partial schema and complete initialization on rerun', async () => {
      // 1. Manually apply only the first 4 migrations
      await executor.execute('CREATE DATABASE IF NOT EXISTS EDUBRIDGE_ADAPTIVE');
      await executor.execute('CREATE SCHEMA IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP');
      await migrationRunner.ensureTrackingTable();

      const migrationFiles = migrationRunner.getMigrationFiles().slice(0, 4);
      for (const m of migrationFiles) {
        const fs = require('fs');
        const content = fs.readFileSync(m.fullPath, 'utf8');
        await executor.executeScript(content);
        await executor.execute(
          'INSERT INTO EDUBRIDGE_ADAPTIVE.APP.SCHEMA_MIGRATIONS (migration_file, checksum, execution_time_ms, status) VALUES (?, ?, ?, ?)',
          [m.filename, 'checksum', 1, 'SUCCESS']
        );
      }

      // 2. Verification should detect missing tables
      const partialCheck = await databaseManager.verifySchema();
      expect(partialCheck.isValid).toBe(false);
      expect(partialCheck.missingTables.length).toBeGreaterThan(0);
      expect(partialCheck.missingTables).toContain('LESSONS');
      expect(partialCheck.missingTables).toContain('CONCEPTS');
      expect(partialCheck.missingTables).toContain('AUDIT_LOGS');

      // 3. Rerun initializeDatabase() to heal the schema
      const healedReport = await databaseManager.initializeDatabase();
      expect(healedReport.success).toBe(true);
      expect(healedReport.migrationsApplied.length).toBe(8); // Applied the remaining 8 migrations

      // 4. Verification should now pass completely
      const fullCheck = await databaseManager.verifySchema();
      expect(fullCheck.isValid).toBe(true);
      expect(fullCheck.missingTables).toEqual([]);
    });
  });

  describe('6. Schema Validation & Integrity Checks', () => {
    it('should verify all critical columns exist in each mandatory table', async () => {
      await databaseManager.initializeDatabase();
      const verification = await databaseManager.verifySchema();

      expect(verification.isValid).toBe(true);
      expect(verification.errors).toEqual([]);
      expect(verification.missingColumns).toEqual({});
    });

    it('should fail verification if a mandatory column is missing', async () => {
      await databaseManager.initializeDatabase();

      // Tamper with USERS table to simulate missing column
      const store = connectionManager.getMockStore();
      const usersTable = store.databases['EDUBRIDGE_ADAPTIVE'].schemas['APP'].tables['USERS'];
      usersTable.columns = usersTable.columns.filter(c => c.name !== 'PASSWORD_HASH');

      const verification = await databaseManager.verifySchema();
      expect(verification.isValid).toBe(false);
      expect(verification.missingColumns['USERS']).toContain('PASSWORD_HASH');
      expect(verification.errors.some(e => e.includes('missing expected column: PASSWORD_HASH'))).toBe(true);
    });

    it('should fail verification if database or schema context is wrong', async () => {
      await databaseManager.initializeDatabase();

      // Tamper context
      connectionManager.setCurrentDatabase('WRONG_DB');
      const wrongDbCheck = await databaseManager.verifySchema();
      expect(wrongDbCheck.isValid).toBe(false);
      expect(wrongDbCheck.errors.some(e => e.includes('Current database context is "WRONG_DB"'))).toBe(true);

      connectionManager.setCurrentDatabase('EDUBRIDGE_ADAPTIVE');
      connectionManager.setCurrentSchema('WRONG_SCHEMA');
      const wrongSchCheck = await databaseManager.verifySchema();
      expect(wrongSchCheck.isValid).toBe(false);
      expect(wrongSchCheck.errors.some(e => e.includes('Current schema context is "WRONG_SCHEMA"'))).toBe(true);
    });
  });

  describe('7. Connection Failure Handling', () => {
    it('should return unhealthy status when connection test fails', async () => {
      const testConnectionSpy = jest.spyOn(connectionManager, 'testConnection').mockResolvedValueOnce({
        connected: false,
        mode: 'LIVE_SNOWFLAKE',
        error: 'Network timeout connecting to Snowflake warehouse',
        latencyMs: 5000
      });

      const health = await databaseManager.getDatabaseHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.connected).toBe(false);
      expect(health.error).toContain('Network timeout');

      testConnectionSpy.mockRestore();
    });

    it('should reject initialization when connection fails', async () => {
      const testConnectionSpy = jest.spyOn(connectionManager, 'testConnection').mockResolvedValueOnce({
        connected: false,
        mode: 'LIVE_SNOWFLAKE',
        error: 'Invalid Snowflake account or credentials',
        latencyMs: 150
      });

      await expect(databaseManager.initializeDatabase()).rejects.toThrow(
        /Cannot initialize database: Snowflake connection failed/
      );

      testConnectionSpy.mockRestore();
    });
  });

  describe('8. Migration Failure Handling', () => {
    it('should abort migration and throw error if a statement fails', async () => {
      await executor.execute('CREATE DATABASE IF NOT EXISTS EDUBRIDGE_ADAPTIVE');
      await executor.execute('CREATE SCHEMA IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP');
      await migrationRunner.ensureTrackingTable();

      // Spy on executor.executeScript to simulate syntax error in a migration file
      const executeScriptSpy = jest.spyOn(executor, 'executeScript').mockRejectedValueOnce(
        new Error('SQL compilation error: syntax error at line 1')
      );

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        /Migration 001_create_database.sql failed/
      );

      // Verify that the failed migration was NOT recorded as SUCCESS
      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).not.toContain('001_create_database.sql');

      executeScriptSpy.mockRestore();
    });
  });

  describe('9. Database Health Diagnostics', () => {
    it('should report healthy status when database is fully initialized', async () => {
      await databaseManager.initializeDatabase();
      const health = await databaseManager.getDatabaseHealth();

      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
      expect(health.database).toBe('EDUBRIDGE_ADAPTIVE');
      expect(health.schema).toBe('APP');
      expect(health.tablesCount).toBeGreaterThanOrEqual(10);
    });
  });
});
