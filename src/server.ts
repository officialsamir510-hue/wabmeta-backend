// src/server.ts

import http from 'http';

import app from './app';
import { config } from './config';
import prisma from './config/database';
import { initializeSocket } from './socket';
import { validateEncryptionKey } from './utils/encryption';

async function bootstrap() {
  try {
    // ============================================
    // Step 1: Validate Encryption Key FIRST
    // ============================================
    console.log('🔐 Validating encryption configuration...');

    const encryptionValid = validateEncryptionKey();

    if (!encryptionValid) {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ ENCRYPTION KEY NOT CONFIGURED!');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('💡 Add ENCRYPTION_KEY to your .env file:');
      console.error('');
      console.error('   ENCRYPTION_KEY=your-32-character-secret-key-here');
      console.error('');
      console.error('💡 Generate a secure key with:');
      console.error('');
      console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // In production, exit immediately
      if (config.nodeEnv === 'production') {
        console.error('🛑 Exiting: Encryption key required in production');
        process.exit(1);
      } else {
        console.warn('⚠️  WARNING: Running without encryption in development mode');
        console.warn('⚠️  Token encryption/decryption WILL FAIL!');
        console.warn('');
      }
    } else {
      console.log('✅ Encryption key validated');
    }

    // ============================================
    // Step 2: Test Database Connection
    // ============================================
    console.log('📦 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // ============================================
    // Step 3: Create HTTP Server
    // ============================================
    const server = http.createServer(app);

    // ============================================
    // Step 4: Initialize Socket.io
    // ============================================
    initializeSocket(server);
    console.log('✅ Socket.io initialized');

    // ============================================
    // Step 5: Start Server
    // ============================================
    const PORT = config.port || 5000;

    server.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 SERVER IS RUNNING!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`   📡 API:         http://localhost:${PORT}`);
      console.log(`   🌍 Environment: ${config.nodeEnv}`);
      console.log(`   🔗 Frontend:    ${config.frontendUrl || 'http://localhost:3000'}`);
      console.log(`   🔐 Encryption:  ${encryptionValid ? 'ENABLED ✓' : 'DISABLED ✗'}`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });

    // ============================================
    // Graceful Shutdown Handler
    // ============================================
    const shutdown = async (signal: string) => {
      console.log('');
      console.log(`🔄 Received ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          await prisma.$disconnect();
          console.log('✅ Database disconnected');
        } catch (err) {
          console.error('⚠️ Error disconnecting database:', err);
        }

        console.log('👋 Goodbye!');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Graceful shutdown timed out. Forcing exit...');
        process.exit(1);
      }, 10000);
    };

    // Signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ============================================
    // Error Handlers
    // ============================================

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ UNCAUGHT EXCEPTION');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ UNHANDLED REJECTION');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Promise:', promise);
      console.error('Reason:', reason);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      shutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FAILED TO START SERVER');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
}

// Start the server
bootstrap();