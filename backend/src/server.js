/**
 * EduBridge Adaptive - Server Entry Point
 *
 * Validates environment configuration before boot, binds HTTP port,
 * and handles graceful shutdown.
 */

const { validateEnv } = require('./config/env');
const logger = require('./utils/logger');

let server;

function startServer() {
  try {
    // 1. Validate required environment variables safely before startup
    const config = validateEnv(process.env);

    // 2. Load app after environment validation
    const app = require('./app');

    // 3. Start listening
    server = app.listen(config.port, () => {
      logger.info(`EduBridge Adaptive Server started successfully`, {
        service: config.serviceName,
        env: config.env,
        port: config.port,
        corsOrigin: config.corsOrigin
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Stop the existing EduBridge backend process or configure another PORT.`);
        process.exit(1);
      } else {
        logger.error(`Fatal Server Error: ${err.message}`);
        process.exit(1);
      }
    });

    return server;
  } catch (err) {
    logger.error(`Fatal Server Startup Failure: ${err.message}`);
    process.exit(1);
  }
}

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down server...`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forcefully stopping server after shutdown timeout.');
      process.exit(1);
    }, 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', { promise, reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  server
};
