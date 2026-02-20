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
    // 1. Render servers lack outbound IPv6, so we must use Supabase IPv4 pooler.
    // 2. However, the default Transaction pooler (port 6543) aggressively drops idle connections,
    //    causing Prisma P1001 errors "Can't reach database server" after some time.
    // 3. We forcefully switch to the Session pooler (port 5432), which acts exactly like a 
    //    direct connection, keeps sockets alive, and runs perfectly on Node.js backends.

    try {
      const parsedUrl = new URL(dbUrl);

      // Force port 5432 (Session pooler)
      if (parsedUrl.port === '6543') {
        parsedUrl.port = '5432';
      }

      // Session pooler fully supports prepared statements, so remove pgbouncer=true
      parsedUrl.searchParams.delete('pgbouncer');

      // Add sane limits for long-running Node process
      if (!parsedUrl.searchParams.has('connection_limit')) {
        parsedUrl.searchParams.set('connection_limit', '10');
      }
      if (!parsedUrl.searchParams.has('pool_timeout')) {
        parsedUrl.searchParams.set('pool_timeout', '30');
      }

      dbUrl = parsedUrl.toString();
      prismaOptions.datasources = { db: { url: dbUrl } };
      console.log('🔧 Auto-configured Supabase Session pooler (Port 5432) to prevent idle P1001 timeouts');
    } catch (err) {
      console.error('⚠️ Failed to auto-configure Supabase pooler URL:', err);
    }
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