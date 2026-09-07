/**
 * EduBridge Adaptive - Secure Authentication Test Suite
 *
 * MANDATED TESTS:
 * 1. signup: Registers new user, returns 201, delivers JWT via HttpOnly cookie,
 *            omits plain-text password/hash and token from response body, stores bcrypt hash in Snowflake.
 * 2. duplicate email: Rejects registration with existing email returning 409 Conflict.
 * 3. invalid password: Enforces minimum length and complexity, returning 400 Validation Error.
 * 4. login: Authenticates valid credentials, sets HttpOnly cookie, returns safe user.
 * 5. wrong password: Rejects incorrect password with 401 Unauthorized, never sets cookie.
 * 6. logout: Clears HttpOnly authentication cookie, returns 200 OK.
 * 7. expired token: Rejects expired JWT with 401 Unauthorized and TOKEN_EXPIRED code.
 * 8. missing token: Rejects unauthenticated request to protected route with 401 and MISSING_TOKEN code.
 * 9. protected route: Grants access to GET /api/auth/me with valid cookie; enforces role authorization.
 * 10. user isolation: Prevents authenticated user from spoofing or accessing foreign user's data.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_edubridge_adaptive_auth_verification_key_32bytes';

const request = require('supertest');
const app = require('../../src/app');
const JwtUtil = require('../../src/utils/jwt');
const PasswordUtil = require('../../src/utils/password');
const userRepository = require('../../src/repositories/userRepository');

describe('Secure Authentication & Authorization Service', () => {
  const timestamp = Date.now();
  const testStudent = {
    email: `auth_student_${timestamp}@edubridge.org`,
    password: 'SecurePassword123!',
    fullName: 'Alex Student',
    role: 'student',
    gradeLevel: 'Grade 10',
    preferredLanguage: 'en',
    accessibilityPreferences: {
      highContrast: true,
      voiceSpeed: 1.2
    }
  };

  let studentAuthCookie = null;
  let createdStudentId = null;

  // ==========================================================================
  // 1. SIGNUP
  // ==========================================================================
  describe('1. POST /api/auth/signup', () => {
    it('should register a new user, hash password with bcrypt, deliver JWT in HttpOnly cookie, and omit token/hash from body', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testStudent);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');

      // User payload checks
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.user.email).toBe(testStudent.email.toLowerCase());
      expect(res.body.data.user.fullName).toBe(testStudent.fullName);
      expect(res.body.data.user.role).toBe('student');

      // SECURITY RULES: Never expose plain-text password, passwordHash, or return token in body
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();

      // Check HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(tokenCookie).toMatch(/Path=\//i);

      createdStudentId = res.body.data.user.id;
      studentAuthCookie = tokenCookie.split(';')[0]; // Save 'token=...' for authenticated requests

      // Verify Snowflake DB persistence & bcrypt hash
      const dbUser = await userRepository.findByEmail(testStudent.email);
      expect(dbUser).not.toBeNull();
      expect(dbUser.passwordHash).not.toBe(testStudent.password);
      expect(dbUser.passwordHash.startsWith('$2')).toBe(true); // Standard bcrypt format
    });
  });

  // ==========================================================================
  // 2. DUPLICATE EMAIL
  // ==========================================================================
  describe('2. Duplicate Email Prevention', () => {
    it('should reject signup with an already registered email returning 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: testStudent.email, // duplicate email
          password: 'AnotherPassword999!',
          fullName: 'Imposter Student'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  // ==========================================================================
  // 3. INVALID PASSWORD
  // ==========================================================================
  describe('3. Password Complexity & Validation', () => {
    it('should reject empty or missing password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `invalid_pwd_1_${timestamp}@edubridge.org`,
          fullName: 'Test User'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `invalid_pwd_2_${timestamp}@edubridge.org`,
          password: 'Pass1', // only 5 characters
          fullName: 'Test User'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    it('should reject password with letters only (missing digits)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `invalid_pwd_3_${timestamp}@edubridge.org`,
          password: 'OnlyLettersPassword',
          fullName: 'Test User'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/at least one letter and at least one number/i);
    });

    it('should reject password with digits only (missing letters)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `invalid_pwd_4_${timestamp}@edubridge.org`,
          password: '123456789012',
          fullName: 'Test User'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/at least one letter and at least one number/i);
    });
  });

  // ==========================================================================
  // 4. LOGIN
  // ==========================================================================
  describe('4. POST /api/auth/login', () => {
    it('should authenticate valid credentials, deliver JWT via HttpOnly cookie, and omit token/hash from body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.email,
          password: testStudent.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');

      // User payload checks
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBe(createdStudentId);
      expect(res.body.data.user.email).toBe(testStudent.email.toLowerCase());
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();

      // Check HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);

      studentAuthCookie = tokenCookie.split(';')[0];
    });
  });

  // ==========================================================================
  // 5. WRONG PASSWORD
  // ==========================================================================
  describe('5. Wrong Password Handling', () => {
    it('should reject login with wrong password returning 401 and never setting cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.email,
          password: 'CompletelyWrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toMatch(/invalid email or password/i);

      // Must not set authentication cookie
      const cookies = res.headers['set-cookie'];
      const tokenCookie = cookies?.find(c => c.startsWith('token=') && !c.includes('token=;'));
      expect(tokenCookie).toBeUndefined();
    });

    it('should reject login with non-existent email returning generic 401 without user enumeration', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'non_existent_user_9999@edubridge.org',
          password: 'AnyPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // ==========================================================================
  // 6. LOGOUT
  // ==========================================================================
  describe('6. POST /api/auth/logout', () => {
    it('should clear HttpOnly authentication cookie and return 200 OK', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', studentAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logout successful');

      // Check cookie clearance
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      // Cookie is cleared by setting max-age=0 or expires in past
      expect(
        tokenCookie.includes('Max-Age=0') ||
        tokenCookie.includes('expires=Thu, 01 Jan 1970') ||
        tokenCookie.startsWith('token=;')
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 7. EXPIRED TOKEN
  // ==========================================================================
  describe('7. Expired Token Handling', () => {
    it('should reject request with expired JWT token returning 401 and TOKEN_EXPIRED code', async () => {
      // Generate an expired token (expiresIn: '0s')
      const expiredToken = JwtUtil.generateToken(
        { id: createdStudentId, email: testStudent.email, role: 'student' },
        { expiresIn: '0s' }
      );

      // Wait 50ms to ensure expiration
      await new Promise(r => setTimeout(r, 50));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
      expect(res.body.message).toMatch(/token has expired/i);
    });
  });

  // ==========================================================================
  // 8. MISSING TOKEN
  // ==========================================================================
  describe('8. Missing Token Handling', () => {
    it('should reject unauthenticated request to protected endpoint returning 401 and MISSING_TOKEN', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
      expect(res.body.message).toMatch(/authentication required/i);
    });
  });

  // ==========================================================================
  // 9. PROTECTED ROUTE & AUTHORIZATION
  // ==========================================================================
  describe('9. Protected Routes & Authorization', () => {
    it('should grant access to GET /api/auth/me with valid HttpOnly cookie and return fresh profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', studentAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(createdStudentId);
      expect(res.body.data.user.email).toBe(testStudent.email.toLowerCase());
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should allow Bearer token in Authorization header as API fallback', async () => {
      const rawToken = JwtUtil.generateToken({
        id: createdStudentId,
        email: testStudent.email,
        role: 'student'
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(createdStudentId);
    });

    it('should block student from accessing teacher-only route with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/test/teacher-only')
        .set('Cookie', studentAuthCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should grant teacher access to teacher-only route', async () => {
      // Create teacher account
      const teacherRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `teacher_${timestamp}@edubridge.org`,
          password: 'TeacherPassword123!',
          fullName: 'Prof. Miller',
          role: 'teacher'
        });

      const teacherCookie = teacherRes.headers['set-cookie'][0].split(';')[0];

      const res = await request(app)
        .get('/api/auth/test/teacher-only')
        .set('Cookie', teacherCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('teacher');
    });
  });

  // ==========================================================================
  // 10. USER ISOLATION
  // ==========================================================================
  describe('10. User Isolation Enforcement & Frontend Identity Protection', () => {
    let studentBId = null;

    beforeAll(async () => {
      // Create student B
      const studentB = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `student_b_${timestamp}@edubridge.org`,
          password: 'PasswordStudentB123!',
          fullName: 'Bob Student',
          role: 'student'
        });
      studentBId = studentB.body.data.user.id;
    });

    it('should allow student to access their own isolated resource', async () => {
      const res = await request(app)
        .get(`/api/auth/test/isolated-student/${createdStudentId}`)
        .set('Cookie', studentAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessedUserId).toBe(createdStudentId);
    });

    it('should block Student A from accessing Student B resources with 403 USER_ISOLATION_VIOLATION', async () => {
      // Student A tries to access Student B's endpoint
      const res = await request(app)
        .get(`/api/auth/test/isolated-student/${studentBId}`)
        .set('Cookie', studentAuthCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_ISOLATION_VIOLATION');
      expect(res.body.message).toMatch(/cannot access or modify resources belonging to another user/i);
    });

    it('should never trust user_id supplied in body: strictly overrides with authenticated user context', async () => {
      // Student A sends req.body with userId set to Student B's ID to attempt spoofing
      const res = await request(app)
        .post('/api/auth/test/mutate-profile')
        .set('Cookie', studentAuthCookie)
        .send({
          userId: studentBId, // Spoofed ID
          gradeLevel: 'Grade 12'
        });

      expect(res.status).toBe(200);
      // The backend must have strictly overridden the body userId with Student A's real authenticated ID
      expect(res.body.data.authenticatedUserId).toBe(createdStudentId);
      expect(res.body.data.bodyUserId).toBe(createdStudentId);
      expect(res.body.data.bodyUserId).not.toBe(studentBId);
    });
  });
});
