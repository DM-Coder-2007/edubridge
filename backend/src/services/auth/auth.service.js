/**
 * EduBridge Adaptive - Authentication Service
 *
 * Core business logic for student and educator authentication:
 * - Secure password hashing with bcrypt (never stores plain-text passwords)
 * - Strict password complexity and email validation
 * - Duplicate registration prevention with typed ConflictError
 * - JWT issuance and cryptographic verification
 * - User isolation enforcement (never trusts client-supplied user IDs)
 * - Snowflake database persistence via UserRepository
 */

const userRepository = require('../../repositories/user.repository');
const PasswordUtil = require('../../utils/password');
const JwtUtil = require('../../utils/jwt');
const {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
} = require('../../utils/errors');
const logger = require('../../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

class AuthService {
  /**
   * Validate email format and normalize
   * @param {string} email
   * @returns {string} normalized email
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('A valid email address is required.', { field: 'email' });
    }
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) {
      throw new ValidationError(`Invalid email format: "${email}".`, { field: 'email' });
    }
    return normalized;
  }

  /**
   * Validate password complexity
   * Rules:
   * - Must be a string
   * - Minimum 8 characters
   * - Must contain at least one letter and at least one digit
   * @param {string} password
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required and must be a string.', { field: 'password' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        { field: 'password', minLength: MIN_PASSWORD_LENGTH, receivedLength: password.length }
      );
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    if (!hasLetter || !hasDigit) {
      throw new ValidationError(
        'Password must contain at least one letter and at least one number.',
        { field: 'password' }
      );
    }
  }

  /**
   * Register / Sign up a new user
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.fullName
   * @param {string} [params.role='student']
   * @param {string} [params.gradeLevel]
   * @param {string} [params.preferredLanguage='en']
   * @param {object} [params.accessibilityPreferences]
   * @returns {Promise<{ user: object, token: string }>}
   */
  async signup({
    email,
    password,
    fullName,
    role = 'student',
    gradeLevel = null,
    preferredLanguage = 'en',
    accessibilityPreferences = {}
  }) {
    // 1. Validate inputs
    const normalizedEmail = this.validateEmail(email);
    this.validatePassword(password);

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      throw new ValidationError('Full name is required (minimum 2 characters).', { field: 'fullName' });
    }

    const normalizedRole = String(role || 'student').toLowerCase().trim();
    const ALLOWED_ROLES = ['student', 'teacher', 'admin', 'parent'];
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      throw new ValidationError(
        `Invalid role: "${role}". Allowed roles: ${ALLOWED_ROLES.join(', ')}.`,
        { field: 'role' }
      );
    }

    // 2. Duplicate email check in Snowflake
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      logger.warn(`[AuthService] Signup conflict: Account already exists for email: ${normalizedEmail}`);
      throw new ConflictError('An account with this email already exists.', { email: normalizedEmail });
    }

    // 3. Password Hashing (bcrypt) - NEVER store plain-text passwords
    const passwordHash = await PasswordUtil.hash(password);

    // 4. Default accessibility profile for educational inclusivity
    const defaultAccessibility = {
      screenReader: true,
      voiceSpeed: 1.0,
      highContrast: false,
      audioCues: true,
      tactileDiagrams: true,
      ...(accessibilityPreferences || {})
    };

    // 5. Persist to Snowflake
    const createdUser = await userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: fullName.trim(),
      role: normalizedRole,
      gradeLevel: gradeLevel || null,
      preferredLanguage: preferredLanguage || 'en',
      accessibilityPreferences: defaultAccessibility
    });

    logger.info(`[AuthService] New user registered successfully: ${createdUser.id} (${createdUser.email})`);

    // 6. Generate JWT
    const token = JwtUtil.generateToken({
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role
    });

    // 7. Strip sensitive credentials from user response object
    const { passwordHash: _, ...safeUser } = createdUser;

    return {
      user: safeUser,
      token
    };
  }

  /**
   * Authenticate / Log in an existing user
   *
   * @param {object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<{ user: object, token: string }>}
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required.', {
        missingFields: [!email && 'email', !password && 'password'].filter(Boolean)
      });
    }

    const normalizedEmail = this.validateEmail(email);

    // 1. Look up user in Snowflake
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      logger.warn(`[AuthService] Login failed: User not found for email: ${normalizedEmail}`);
      throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    // 2. Check account status
    if (!user.isActive) {
      logger.warn(`[AuthService] Login blocked: User account is deactivated (${user.id})`);
      throw new ForbiddenError('Account is inactive. Please contact support.', 'ACCOUNT_INACTIVE');
    }

    // 3. Compare password hash with bcrypt
    const isPasswordValid = await PasswordUtil.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn(`[AuthService] Login failed: Password mismatch for user: ${user.id}`);
      throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    logger.info(`[AuthService] User logged in successfully: ${user.id} (${user.email})`);

    // 4. Generate JWT
    const token = JwtUtil.generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // 5. Strip sensitive credentials from user response object
    const { passwordHash: _, ...safeUser } = user;

    return {
      user: safeUser,
      token
    };
  }

  /**
   * Verify JWT token and return payload
   * @param {string} token
   * @returns {object} decoded token payload
   */
  verifyToken(token) {
    return JwtUtil.verifyToken(token);
  }

  /**
   * Get fresh user profile by ID
   * @param {string} userId
   * @returns {Promise<object>} safe user profile
   */
  async getCurrentUser(userId) {
    if (!userId) {
      throw new UnauthorizedError('Authentication required.', 'UNAUTHORIZED');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found.', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new ForbiddenError('User account is inactive.', 'ACCOUNT_INACTIVE');
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Verify user isolation: ensure client cannot act on behalf of another user
   * @param {string} authenticatedUserId
   * @param {string} targetUserId
   * @throws {ForbiddenError} if IDs do not match
   */
  verifyUserIsolation(authenticatedUserId, targetUserId) {
    if (!targetUserId) return true;
    if (String(authenticatedUserId) !== String(targetUserId)) {
      logger.warn(
        `[AuthService] User isolation violation! Authenticated=${authenticatedUserId} attempted target=${targetUserId}`
      );
      throw new ForbiddenError(
        'Access denied: You cannot access or modify resources belonging to another user.',
        'USER_ISOLATION_VIOLATION'
      );
    }
    return true;
  }

  /**
   * Update student/educator accessibility preferences
   * @param {string} userId
   * @param {object} preferences
   * @returns {Promise<object>} updated safe user profile
   */
  async updatePreferences(userId, preferences) {
    if (!userId) {
      throw new UnauthorizedError('Authentication required.', 'UNAUTHORIZED');
    }
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found.', 'USER_NOT_FOUND');
    }
    const merged = {
      ...(user.accessibilityPreferences || {}),
      ...(preferences || {})
    };
    const updatedUser = await userRepository.updatePreferences(userId, merged);
    const { passwordHash: _, ...safeUser } = updatedUser;
    return safeUser;
  }
}


const authService = new AuthService();
module.exports = authService;
