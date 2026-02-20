// src/config/database.ts

import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => {
  let dbUrl = process.env.DATABASE_URL;
  const prismaOptions: any = {
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  };

  if (dbUrl && dbUrl.includes('.pooler.supabase.com')) {
    if (!dbUrl.includes('pgbouncer=true')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    if (!dbUrl.includes('pool_timeout=')) {
      dbUrl += '&pool_timeout=30';
    }
    prismaOptions.datasources = { db: { url: dbUrl } };
    console.log('🔧 Auto-configured Supabase pooler connection string');
  }

  const client = new PrismaClient(prismaOptions);

  // ✅ Add connection retry logic
  client.$connect()
    .then(() => console.log('✅ Database connected'))
    .catch((err) => {
      console.error('❌ Database connection failed:', err);
      // Retry after 5 seconds
      setTimeout(() => {
        client.$connect().catch(console.error);
      }, 5000);
    });

  return client;
};

// Singleton pattern
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
const shutdown = async () => {
  console.log('🔌 Disconnecting database...');
  await prisma.$disconnect();
};

process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;