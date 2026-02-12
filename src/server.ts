// src/server.ts

import http from 'http';
import app from './app';
import { config } from './config';
import { initializeSocket } from './socket';
import prisma from './config/database';
import { validateEncryptionKey } from './utils/encryption';

async function bootstrap() {
  try {
    // ✅ Step 1: Validate encryption key FIRST
    console.log('🔐 Validating encryption configuration...');
    if (!validateEncryptionKey()) {
      console.error('❌ Server startup failed: Invalid encryption configuration');
      console.error('💡 Hint: Set ENCRYPTION_KEY in your .env file (min 32 characters)');
      console.error('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      process.exit(1);
    }

    // ✅ Step 2: Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // ✅ Step 3: Create HTTP server
    const server = http.createServer(app);

    // ✅ Step 4: Initialize Socket.io
    initializeSocket(server);
    console.log('✅ Socket.io initialized');

    // ✅ Step 5: Start server
    server.listen(config.port, () => {
      console.log(`
🚀 Server is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 API:         http://localhost:${config.port}
🌍 Environment: ${config.nodeEnv}
🔐 Encryption:  ENABLED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // ✅ Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        await prisma.$disconnect();
        console.log('✅ Database disconnected');

        console.log('👋 Goodbye!');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Graceful shutdown timed out. Forcing exit...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ✅ Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // ✅ Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();