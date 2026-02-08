// src/server.ts

import http from 'http';
import app from './app';
import { config } from './config';
import { initializeSocket } from './socket';
import prisma from './config/database';

const PORT = config.port || 10000;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔌 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    console.log('🔌 Initializing Socket.IO...');
    const io = initializeSocket(server);
    console.log('✅ Socket.IO initialized successfully');

    // Make io globally accessible (for webhook service)
    (global as any).io = io;

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 WabMeta API Server                                ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(38)}║
║   Port: ${String(PORT).padEnd(45)}║
║   API Version: ${config.apiVersion.padEnd(38)}║
║   Frontend: ${config.frontendUrl.padEnd(41)}║
║   Socket.IO: ✅ Enabled                                ║
║   Health Check: http://localhost:${PORT}/health${' '.padEnd(13)}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

      // Close Socket.IO connections
      io.close(() => {
        console.log('✅ Socket.IO connections closed');
      });

      // Close HTTP server
      server.close(async () => {
        console.log('✅ HTTP server closed');

        // Disconnect database
        await prisma.$disconnect();
        console.log('✅ Database disconnected');

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Export server and io for testing
    return { server, io };

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

// Start the server
startServer();

export default startServer;