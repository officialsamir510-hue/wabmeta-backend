// src/config/database.ts

import { PrismaClient } from '@prisma/client';

// Determine log levels based on environment
const getLogLevels = (): ('query' | 'error' | 'warn' | 'info')[] => {
  if (process.env.NODE_ENV === 'development') {
    return ['query', 'error', 'warn'];
  }
  return ['error', 'warn'];
};

// Create Prisma client with optimized settings
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: getLogLevels(),
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// TypeScript declaration for global prisma instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Use existing global instance or create new one
// This prevents multiple connections in development due to hot reloading
const prisma = globalThis.prisma ?? prismaClientSingleton();

// Store in global only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// ============================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================

// Handle process termination signals
const shutdownHandler = async (signal: string) => {
  console.log(`\n🔌 Received ${signal}. Closing database connection...`);
  await prisma.$disconnect();
  console.log('✅ Database connection closed');
  process.exit(0);
};

// Register shutdown handlers (only once)
if (!globalThis.prisma) {
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

// ============================================
// CONNECTION HEALTH CHECK
// ============================================

/**
 * Check if database connection is healthy
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database connection check failed:', error);
    return false;
  }
};

/**
 * Connect to database with retry logic
 */
export const connectWithRetry = async (
  maxRetries = 5,
  delayMs = 5000
): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error('Failed to connect to database after maximum retries');
      }
      
      console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export default prisma;