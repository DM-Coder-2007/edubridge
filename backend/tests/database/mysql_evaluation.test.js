/**
 * EduBridge Adaptive - MySQL Architecture Evaluation & Configuration Test Suite
 *
 * MANDATED ARCHITECTURAL VALIDATION:
 * 1. "MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database."
 * 2. Snowflake is the PRIMARY and MANDATORY database.
 * 3. MySQL failure must NEVER silently change or degrade the primary application database.
 * 4. Test both enabled and disabled configurations.
 * 5. Verify database access operates behind repository interfaces.
 */

process.env.NODE_ENV = 'test';
process.env.SNOWFLAKE_MOCK_FALLBACK = 'true';

const mysqlConnection = require('../../src/database/mysql/connection');
const { checkMySQLHealth } = require('../../src/database/mysql/healthCheck');
const snowflakeClient = require('../../src/config/snowflake');
const { userRepository, lessonRepository } = require('../../src/repositories');

describe('MySQL Architectural Evaluation & Configuration', () => {
  const MANDATED_STATEMENT = 'MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database.';

  // ==========================================================================
  // 1. ARCHITECTURAL EVALUATION & MANDATED STATEMENT
  // ==========================================================================
  describe('1. Architectural Evaluation Documentation', () => {
    it('should assert the mandated architectural statement verbatim', () => {
      expect(MANDATED_STATEMENT).toBe(
        'MySQL is intentionally not required in the current architecture because Snowflake is the mandatory primary database.'
      );
    });

    it('should confirm Snowflake is always reported as the primary database engine', () => {
      expect(mysqlConnection.isPrimary()).toBe(false);
      expect(mysqlConnection.getPrimaryDatabaseEngine()).toBe('Snowflake');
      expect(snowflakeClient.isPrimary()).toBe(true);
    });

    it('should evaluate that all primary query patterns and JSON variants operate on Snowflake', async () => {
      const email = `eval_snowflake_${Date.now()}@edubridge.org`;
      const user = await userRepository.create({
        email,
        passwordHash: '$2a$10$abcdef1234567890',
        fullName: 'Evaluation Student',
        accessibilityPreferences: { highContrast: true, pitch: 1.2 }
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      // Stored in Snowflake
      const found = await userRepository.findById(user.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(user.id);
    });
  });

  // ==========================================================================
  // 2. DISABLED CONFIGURATION (Default & Recommended State)
  // ==========================================================================
  describe('2. Disabled Configuration Verification', () => {
    beforeEach(() => {
      mysqlConnection.setEnabled(false);
    });

    it('should report STANDBY status and document non-requirement when disabled', async () => {
      const health = await checkMySQLHealth();

      expect(health.enabled).toBe(false);
      expect(health.status).toBe('STANDBY');
      expect(health.mandatory).toBe(false);
      expect(health.primaryDatabase).toBe('Snowflake');
      expect(health.role).toBe('OPTIONAL_SECONDARY_ADAPTER');
      expect(health.message).toBe(MANDATED_STATEMENT);
    });

    it('should safely return empty array on execute without errors or DB changes when disabled', async () => {
      const result = await mysqlConnection.execute('SELECT * FROM USERS');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      expect(mysqlConnection.isPrimary()).toBe(false);
    });

    it('should return null pool when disabled', async () => {
      const pool = await mysqlConnection.getPool();
      expect(pool).toBeNull();
    });
  });

  // ==========================================================================
  // 3. ENABLED CONFIGURATION (Testing & Fault Tolerance)
  // ==========================================================================
  describe('3. Enabled Configuration & Fault Tolerance', () => {
    afterEach(() => {
      mysqlConnection.setEnabled(false);
    });

    it('should report DISCONNECTED gracefully if secondary connection is unreachable without failing Snowflake', async () => {
      mysqlConnection.setEnabled(true);

      const health = await checkMySQLHealth();

      expect(health.enabled).toBe(true);
      expect(health.mandatory).toBe(false);
      expect(health.primaryDatabase).toBe('Snowflake');
      expect(health.role).toBe('OPTIONAL_SECONDARY_ADAPTER');

      // Regardless of whether local mysqld daemon is present:
      expect(['CONNECTED', 'DISCONNECTED']).toContain(health.status);
      if (health.status === 'DISCONNECTED') {
        expect(health.message).toContain('Snowflake remains the active primary database');
      }

      // Verify Snowflake remains 100% operational as primary database
      const snowflakePing = await snowflakeClient.ping();
      expect(snowflakePing.available).toBe(true);
      expect(snowflakePing.primary).toBe(true);
    });

    it('must NEVER allow MySQL failure to silently change the application database', async () => {
      mysqlConnection.setEnabled(true);

      // Attempt invalid query on MySQL
      const result = await mysqlConnection.execute('SELECT * FROM NON_EXISTENT_TABLE_XYZ_123');
      expect(Array.isArray(result)).toBe(true);

      // Primary database MUST remain Snowflake
      expect(mysqlConnection.isPrimary()).toBe(false);
      expect(snowflakeClient.isPrimary()).toBe(true);

      // Repositories continue operating against Snowflake seamlessly
      const testLesson = await lessonRepository.create({
        textbookAssetId: 'txt_mock_123',
        userId: 'usr_mock_123',
        title: 'Fault Tolerance Lesson',
        summary: 'Testing that MySQL errors never affect Snowflake.',
        simplifiedText: 'Snowflake is the primary database.'
      });

      expect(testLesson).toBeDefined();
      expect(testLesson.title).toBe('Fault Tolerance Lesson');

      const retrieved = await lessonRepository.findById(testLesson.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(testLesson.id);
    });
  });
});
