/**
 * EduBridge Adaptive - User Repository (Snowflake)
 *
 * Dedicated data access layer for USERS table in Snowflake.
 * Follows clean architecture: Controller -> Service -> Repository -> Snowflake
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');
const logger = require('../utils/logger');

class UserRepository {
  /**
   * Create a new user record in Snowflake
   * @param {object} userData
   * @returns {Promise<object>}
   */
  async create({
    email,
    passwordHash,
    fullName,
    role = 'student',
    gradeLevel = null,
    preferredLanguage = 'en',
    accessibilityPreferences = {}
  }) {
    const id = uuidv4();
    const userRecord = {
      ID: id,
      EMAIL: email.toLowerCase().trim(),
      PASSWORD_HASH: passwordHash,
      FULL_NAME: fullName.trim(),
      ROLE: role.toLowerCase().trim(),
      GRADE_LEVEL: gradeLevel,
      PREFERRED_LANGUAGE: preferredLanguage,
      ACCESSIBILITY_PREFERENCES: typeof accessibilityPreferences === 'string'
        ? accessibilityPreferences
        : JSON.stringify(accessibilityPreferences),
      IS_ACTIVE: true,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    logger.debug(`[UserRepository] Inserting user ${email} (${id}) into Snowflake`);
    await db.insert('USERS', userRecord);
    return this._format(userRecord);
  }

  /**
   * Find user by email address (case-insensitive)
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    if (!email) return null;
    const row = await db.queryOne(
      'SELECT * FROM USERS WHERE EMAIL = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return this._format(row);
  }

  /**
   * Find user by primary identifier
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne(
      'SELECT * FROM USERS WHERE ID = ? LIMIT 1',
      [id]
    );
    return this._format(row);
  }

  /**
   * Update student/educator accessibility preferences
   * @param {string} id
   * @param {object|string} preferences
   * @returns {Promise<object|null>}
   */
  async updatePreferences(id, preferences) {
    const prefJson = typeof preferences === 'string'
      ? preferences
      : JSON.stringify(preferences);

    await db.query(
      'UPDATE USERS SET ACCESSIBILITY_PREFERENCES = ?, UPDATED_AT = CURRENT_TIMESTAMP() WHERE ID = ?',
      [prefJson, id]
    );
    return this.findById(id);
  }

  /**
   * Update user general profile fields
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object|null>}
   */
  async updateProfile(id, { fullName, gradeLevel, preferredLanguage }) {
    const updates = {};
    if (fullName) updates.FULL_NAME = fullName.trim();
    if (gradeLevel) updates.GRADE_LEVEL = gradeLevel;
    if (preferredLanguage) updates.PREFERRED_LANGUAGE = preferredLanguage;

    if (Object.keys(updates).length > 0) {
      await db.update('USERS', updates, 'ID = ?', [id]);
    }
    return this.findById(id);
  }

  /**
   * Update active status (activate / deactivate account)
   * @param {string} id
   * @param {boolean} isActive
   * @returns {Promise<object|null>}
   */
  async updateStatus(id, isActive) {
    await db.update('USERS', { IS_ACTIVE: Boolean(isActive) }, 'ID = ?', [id]);
    return this.findById(id);
  }

  /**
   * Delete user by primary identifier
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    if (!id) return false;
    await db.query('DELETE FROM USERS WHERE ID = ?', [id]);
    return true;
  }

  /**
   * Format Snowflake row into domain object
   * @private
   */
  _format(row) {
    if (!row) return null;
    let preferences = {};
    if (row.ACCESSIBILITY_PREFERENCES) {
      try {
        preferences = typeof row.ACCESSIBILITY_PREFERENCES === 'string'
          ? JSON.parse(row.ACCESSIBILITY_PREFERENCES)
          : row.ACCESSIBILITY_PREFERENCES;
      } catch {
        preferences = {};
      }
    }

    return {
      id: row.ID,
      email: row.EMAIL,
      passwordHash: row.PASSWORD_HASH,
      fullName: row.FULL_NAME,
      role: row.ROLE,
      gradeLevel: row.GRADE_LEVEL,
      preferredLanguage: row.PREFERRED_LANGUAGE,
      accessibilityPreferences: preferences,
      isActive: Boolean(row.IS_ACTIVE),
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

const userRepository = new UserRepository();
module.exports = userRepository;
