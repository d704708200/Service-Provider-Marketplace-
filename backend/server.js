const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  // Connect to MongoDB if MONGODB_URI is provided
  await connectDB();

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    if (server) {
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await disconnectDB();
          console.log('Graceful shutdown completed successfully.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database disconnect:', err);
          process.exit(1);
        }
      });

      // Force exit if close takes too long
      setTimeout(() => {
        console.error('Forced shutdown: Timed out waiting for connections to close.');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    shutdown('uncaughtException');
  });
};

startServer();

module.exports = { app, startServer };
