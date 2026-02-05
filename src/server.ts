// src/server.ts

import app from './app';
import { config } from './config';
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

    // Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 =====================================');
      console.log(`🚀 WabMeta API Server Started!`);
      console.log(`🚀 Environment: ${config.nodeEnv}`);
      console.log(`🚀 Port: ${PORT}`);
      console.log(`🚀 Frontend: ${config.frontendUrl}`);
      console.log(`🚀 Health: http://localhost:${PORT}/health`);
      console.log('🚀 =====================================');
      console.log('');
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        await prisma.$disconnect();
        console.log('✅ Database disconnected');
        
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();