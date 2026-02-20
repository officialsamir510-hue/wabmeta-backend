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
    // 1. We must use the transaction pooler on port 6543 for Supabase Prisma interactions.
    // 2. We NEED pgbouncer=true to correctly work with the Transaction Pooler.
    if (!dbUrl.includes('pgbouncer=true')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }

    // 3. Add sane limits for long-running Node process
    if (!dbUrl.includes('connection_limit=')) {
      dbUrl += '&connection_limit=10';
    }
    if (!dbUrl.includes('pool_timeout=')) {
      dbUrl += '&pool_timeout=30';
    }

    prismaOptions.datasources = { db: { url: dbUrl } };
    console.log('🔧 Auto-configured Supabase Transaction pooler (pgbouncer=true)');
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