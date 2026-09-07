/**
 * EduBridge Adaptive - Foundation Verification Test Suite
 *
 * Tests:
 * 1. GET /api/health returns { success: true, service: 'edubridge-backend', status: 'healthy' }
 * 2. Request correlation ID generation and propagation (X-Request-Id)
 * 3. Helmet security headers
 * 4. 404 Not Found handling for unknown routes
 * 5. 400 Bad Request on malformed JSON payload
 * 6. CORS policy validation and preflight handling
 * 7. Environment validation & startup failure on missing/invalid configuration
 * 8. Zero secret leakage in structured logging & error handling
 * 9. Async handler utility
 */

const request = require('supertest');
const app = require('../../src/app');
const { validateEnv, config } = require('../../src/config/env');
const logger = require('../../src/utils/logger');
const asyncHandler = require('../../src/utils/asyncHandler');
const ApiResponse = require('../../src/utils/apiResponse');

describe('Foundation: Health Endpoint', () => {
  it('GET /api/health should return exactly the mandated response structure', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      success: true,
      service: 'edubridge-backend',
      status: 'healthy'
    });
  });

  it('GET /health alias should also return the mandated response structure', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      service: 'edubridge-backend',
      status: 'healthy'
    });
  });
});

describe('Foundation: Request ID Middleware', () => {
  it('should generate and return X-Request-Id header when none is provided', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
  });

  it('should propagate incoming X-Request-Id header', async () => {
    const customId = 'client-req-999888';
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});

describe('Foundation: Security Headers (Helmet)', () => {
  it('should set essential Helmet security headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('Foundation: 404 Not Found Handling', () => {
  it('should return consistent 404 JSON for unmapped GET routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found: [GET] /api/non-existent-endpoint',
      error: {
        code: 'NOT_FOUND',
        details: null
      }
    });
  });

  it('should return consistent 404 JSON for unmapped POST routes', async () => {
    const res = await request(app).post('/api/unmapped/action');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Foundation: Centralized Error & Malformed JSON Handling', () => {
  it('should intercept malformed JSON bodies and return 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"invalid": broken json syntax');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Malformed JSON payload in request body',
      error: {
        code: 'MALFORMED_JSON',
        details: null
      }
    });
  });
});

describe('Foundation: CORS Configuration', () => {
  it('should handle preflight OPTIONS requests', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://edubridge.org')
      .set('Access-Control-Request-Method', 'GET');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should allow requests from permitted origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://edubridge.org');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('Foundation: Environment Validation & Startup Failure', () => {
  it('should pass validation when required environment variables are present and valid', () => {
    const validEnv = {
      NODE_ENV: 'development',
      PORT: '5000',
      CORS_ORIGIN: '*'
    };

    const validated = validateEnv(validEnv);
    expect(validated.env).toBe('development');
    expect(validated.port).toBe(5000);
  });

  it('should throw an error when NODE_ENV is missing', () => {
    const invalidEnv = {
      PORT: '5000'
    };

    expect(() => validateEnv(invalidEnv)).toThrow(/Missing required environment variable: NODE_ENV/);
  });

  it('should throw an error when PORT is missing', () => {
    const invalidEnv = {
      NODE_ENV: 'production'
    };

    expect(() => validateEnv(invalidEnv)).toThrow(/Missing required environment variable: PORT/);
  });

  it('should throw an error when NODE_ENV has an invalid value', () => {
    const invalidEnv = {
      NODE_ENV: 'unsupported_env_type',
      PORT: '5000'
    };

    expect(() => validateEnv(invalidEnv)).toThrow(/Invalid NODE_ENV/);
  });

  it('should throw an error when PORT is non-numeric or out of range', () => {
    expect(() => validateEnv({ NODE_ENV: 'development', PORT: 'not-a-port' })).toThrow(/Invalid PORT/);
    expect(() => validateEnv({ NODE_ENV: 'development', PORT: '-5' })).toThrow(/Invalid PORT/);
    expect(() => validateEnv({ NODE_ENV: 'development', PORT: '70000' })).toThrow(/Invalid PORT/);
  });
});

describe('Foundation: Zero Secret Leakage in Structured Logging', () => {
  it('should redact sensitive keys in objects recursively', () => {
    const sensitivePayload = {
      user: {
        id: 'usr-1',
        email: 'student@example.com',
        password: 'SuperSecretPassword123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
        credentials: {
          apiKey: 'AIzaSyDemoKey123',
          jwt_secret: 'topsecretkey'
        }
      },
      publicData: 'accessible learning'
    };

    const sanitized = logger.redactSensitive(sensitivePayload);

    expect(sanitized.user.password).toBe('***REDACTED***');
    expect(sanitized.user.token).toBe('***REDACTED***');
    expect(sanitized.user.credentials.apiKey).toBe('***REDACTED***');
    expect(sanitized.user.credentials.jwt_secret).toBe('***REDACTED***');
    expect(sanitized.user.email).toBe('student@example.com');
    expect(sanitized.publicData).toBe('accessible learning');
  });

  it('should redact secrets embedded in strings (Bearer tokens and query params)', () => {
    const logString = 'Failed authentication with Bearer eyJhbGciOiJIUzI1Ni.abc.xyz and password=MySecretPassword';
    const sanitized = logger.redactSensitive(logString);

    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1Ni.abc.xyz');
    expect(sanitized).not.toContain('MySecretPassword');
    expect(sanitized).toContain('Bearer ***REDACTED***');
    expect(sanitized).toContain('password=***REDACTED***');
  });
});

describe('Foundation: Async Handler Utility', () => {
  it('should execute successfully when wrapped async function resolves', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    const handler = asyncHandler(async (req, res) => {
      res.status(200).json({ ok: true });
    });

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('should catch errors in async functions and forward them to next()', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const testError = new Error('Async failure test');

    const handler = asyncHandler(async () => {
      throw testError;
    });

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(testError);
  });
});
