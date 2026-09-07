
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const { config } = require('./config/env');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const perfLogger = require('./middleware/perfLogger');
const errorMiddleware = require('./middleware/error.middleware');
const notFoundMiddleware = require('./middleware/notFound.middleware');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const textbookRoutes = require('./routes/textbook.routes');
const lessonRoutes = require('./routes/lesson.routes');
const questionRoutes = require('./routes/question.routes');
const conceptRoutes = require('./routes/concept.routes');
const speechRoutes = require('./routes/speech.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const mediaRoutes = require('./routes/media.routes');
const quizRoutes = require('./routes/quizRoutes');
const progressRoutes = require('./routes/progressRoutes');
const ApiResponse = require('./utils/apiResponse');

const app = express();

// 1. Security HTTP Headers
app.use(helmet());

// 2. Request Correlation ID & Performance Logger
app.use(requestIdMiddleware);
app.use(perfLogger);

// 3. CORS Configuration from Environment
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map(o => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.isTest ? 1000 : config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      429,
      'Too many requests, please try again later.',
      'RATE_LIMIT_EXCEEDED'
    );
  }
});

app.use(limiter);

// 5. Body Parsers with Sensible Limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Cookie Parser for HttpOnly Auth Tokens
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'edubridge_cookie_secret'));

// 7. Root & Health Check Endpoints
app.get('/', (req, res) => {
  return ApiResponse.success(res, 200, 'EduBridge Adaptive Backend API', {
    name: 'EduBridge Adaptive Backend',
    version: '1.0.0',
    database: 'Snowflake (Primary)',
    tts: 'Piper TTS',
    speechRecognition: 'faster-whisper',
    ai: 'Google Gemini',
    media: 'Cloudinary'
  });
});
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

// 8. Authentication Endpoints
app.use('/api/auth', authRoutes);

// 9. Core EduBridge Resource Endpoints
app.use('/api/textbooks', textbookRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/concepts', conceptRoutes);
app.use('/api/speech', speechRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progress', progressRoutes);
app.use(notFoundMiddleware);

app.use(errorMiddleware);

module.exports = app;
