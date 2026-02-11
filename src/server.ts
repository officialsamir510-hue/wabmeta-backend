// src/server.ts

import http from 'http';
import app from './app';
import { config } from './config';
import { initializeSocket } from './socket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bootstrap() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    initializeSocket(server);
    console.log('✅ Socket.io initialized');

    // Start server
    server.listen(config.port, () => {
      console.log(`
🚀 Server is running!
📡 API: http://localhost:${config.port}
🌍 Environment: ${config.nodeEnv}
      `);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🔄 Shutting down gracefully...');

      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();