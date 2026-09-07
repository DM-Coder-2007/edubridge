/**
 * EduBridge Adaptive - Unit Tests: Utils
 */

const {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
} = require('../../src/utils/errors');
const ApiResponse = require('../../src/utils/apiResponse');
const { generateToken, verifyToken } = require('../../src/utils/jwt');
const { hashPassword, comparePassword } = require('../../src/utils/password');
const { escapeXml, stripXml } = require('../../src/utils/xml');

describe('Utils: Errors', () => {
  it('should instantiate AppError with correct defaults', () => {
    const err = new AppError('Something went wrong', 500, 'SERVER_ERROR');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.errorCode).toBe('SERVER_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('should instantiate ValidationError with 400', () => {
    const err = new ValidationError('Invalid input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('should instantiate NotFoundError with 404', () => {
    const err = new NotFoundError('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('NOT_FOUND');
  });

  it('should instantiate UnauthorizedError with 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.errorCode).toBe('UNAUTHORIZED');
  });

  it('should instantiate ForbiddenError with 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.errorCode).toBe('FORBIDDEN');
  });

  it('should instantiate ConflictError with 409', () => {
    const err = new ConflictError('Email already exists');
    expect(err.statusCode).toBe(409);
    expect(err.errorCode).toBe('CONFLICT');
  });
});

describe('Utils: ApiResponse', () => {
  it('should format success responses correctly', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    ApiResponse.success(res, 200, 'Success message', { item: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Success message',
        data: { item: 1 }
      })
    );
  });

  it('should format error responses correctly', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    ApiResponse.error(res, 400, 'Bad request', 'INVALID_REQ');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Bad request',
        error: { code: 'INVALID_REQ', details: null }
      })
    );
  });
});

describe('Utils: JWT', () => {
  it('should sign and verify valid JWT tokens', () => {
    const payload = { id: 'usr-123', email: 'student@example.com', role: 'STUDENT' };
    const token = generateToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.id).toBe('usr-123');
    expect(decoded.email).toBe('student@example.com');
  });

  it('should throw UnauthorizedError on invalid token', () => {
    expect(() => verifyToken('invalid.jwt.token')).toThrow();
  });
});

describe('Utils: Password Hashing', () => {
  it('should hash a password and verify matching password', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);
    expect(hash).not.toBe(raw);

    const isMatch = await comparePassword(raw, hash);
    expect(isMatch).toBe(true);

    const isWrong = await comparePassword('WrongPassword', hash);
    expect(isWrong).toBe(false);
  });
});

describe('Utils: XML Escaping for TTS', () => {
  it('should escape special XML characters', () => {
    const text = 'H2O & CO2 < 100 > "boiling" \'point\'';
    const escaped = escapeXml(text);
    expect(escaped).toBe('H2O &amp; CO2 &lt; 100 &gt; &quot;boiling&quot; &apos;point&apos;');
  });

  it('should strip XML tags', () => {
    const text = '<speak><break time="1s"/>Hello world</speak>';
    const stripped = stripXml(text);
    expect(stripped).toBe('Hello world');
  });
});
