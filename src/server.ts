// src/server.ts - COMPLETE & OPTIMIZED

import http from 'http';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import { initializeSocket } from './socket';
import { validateEncryptionKey } from './utils/encryption';
import { logger } from './utils/logger';

// Optional services
let messageQueueWorker: any = null;
let webhookService: any = null;

async function loadOptionalServices() {
  try {
    const queueModule = await import('./services/messageQueue.service');
    messageQueueWorker = queueModule.messageQueueWorker;
    console.log('✅ Message queue service loaded');
  } catch (error) {
    console.log('ℹ️  Message queue service not available (optional)');
  }

  try {
    const webhookModule = await import('./modules/webhooks/webhook.service');
    webhookService = webhookModule.webhookService;
    console.log('✅ Webhook service loaded');
  } catch (error) {
    console.log('ℹ️  Webhook service not available (optional)');
  }
}

// ============================================
// BOOTSTRAP
// ============================================

async function bootstrap() {
  try {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 WABMETA API SERVER STARTING...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // ============================================
    // Step 1: Validate Encryption Key
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

      if (config.app.isProduction) {
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

    // Test query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');

    // ============================================
    // Step 3: Load Optional Services
    // ============================================
    console.log('📦 Loading optional services...');
    await loadOptionalServices();

    // ============================================
    // Step 4: Start Message Queue Worker
    // ============================================
    if (messageQueueWorker) {
      console.log('🔄 Starting message queue worker...');

      try {
        await messageQueueWorker.start();
        console.log('✅ Message queue worker started');

        messageQueueWorker.on('message:sent', (data: any) => {
          // Silent - only log in dev if needed
        });

        messageQueueWorker.on('message:failed', (data: any) => {
          console.error(`❌ Message failed: ${data.error}`);
        });

        messageQueueWorker.on('batch:complete', (data: any) => {
          if (data.processed > 0) {
            console.log(
              `✅ Batch processed: ${data.succeeded}/${data.processed} in ${data.duration}ms`
            );
          }
        });
      } catch (error) {
        console.error('⚠️ Failed to start message queue worker:', error);
        console.log('ℹ️  Server will continue without queue worker');
      }
    }

    // ============================================
    // Step 5: Create HTTP Server
    // ============================================
    const server = http.createServer(app);

    // ============================================
    // Step 6: Initialize Socket.io
    // ============================================
    console.log('🔌 Initializing Socket.io...');
    initializeSocket(server);
    console.log('✅ Socket.io initialized');

    // ================= ==========================
    // Step 7: Start Cron Jobs
    // ============================================
    console.log('⏰ Starting cron jobs...');
    startCronJobs();
    console.log('✅ Cron jobs started');

    // ============================================
    // Step 8: Initialize Redis (NEW)
    // ============================================
    try {
      const { initRedis } = await import('./config/redis');
      initRedis();
    } catch (error) {
      console.warn('⚠️  Redis initialization failed:', error);
    }

    // ============================================
    // Step 8: Start Server
    // ============================================
    const PORT = config.port || 5000;

    server.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 SERVER IS RUNNING!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`   📡 API:           http://localhost:${PORT}`);
      console.log(`   🌍 Environment:   ${config.app.env}`);
      console.log(`   🔗 Frontend:      ${config.frontendUrl}`);
      console.log(`   🔐 Encryption:    ${encryptionValid ? 'ENABLED ✓' : 'DISABLED ✗'}`);
      console.log(`   📨 Queue Worker:  ${messageQueueWorker?.isRunning ? 'RUNNING ✓' : 'DISABLED ✗'}`);
      console.log(`   🔌 Socket.io:     ENABLED ✓`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });

    // ============================================
    // Graceful Shutdown
    // ============================================
    const shutdown = async (signal: string) => {
      console.log('');
      console.log(`🔄 Received ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          if (messageQueueWorker && messageQueueWorker.isRunning) {
            console.log('🔄 Stopping message queue worker...');
            await messageQueueWorker.stop();
            console.log('✅ Message queue worker stopped');
          }

          await prisma.$disconnect();
          console.log('✅ Database disconnected');
        } catch (err) {
          console.error('⚠️ Error during shutdown:', err);
        }

        console.log('👋 Goodbye!');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('⚠️ Graceful shutdown timed out. Forcing exit...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ============================================
    // Error Handlers
    // ============================================

    process.on('uncaughtException', (error) => {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ UNCAUGHT EXCEPTION');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ UNHANDLED REJECTION');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Promise:', promise);
      console.error('Reason:', reason);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

// ============================================
// CRON JOBS
// ============================================

function startCronJobs() {
  // ✅ 1. Health check every 3 minutes
  setInterval(
    async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        console.error('❌ DB Health check failed:', error);
      }
    },
    3 * 60 * 1000
  );

  // ✅ 2. Expire conversation windows every 5 minutes
  if (webhookService?.expireConversationWindows) {
    setInterval(
      async () => {
        try {
          await webhookService.expireConversationWindows();
        } catch (error) {
          console.error('❌ Error in window expiry cron:', error);
        }
      },
      5 * 60 * 1000
    );
  }

  // ✅ 3. Reset daily message limits every hour
  if (webhookService?.resetDailyMessageLimits) {
    setInterval(
      async () => {
        try {
          await webhookService.resetDailyMessageLimits();
        } catch (error) {
          console.error('❌ Error in limit reset cron:', error);
        }
      },
      60 * 60 * 1000
    );
  }

  // ✅ 4. Clean up old queue messages daily
  if (messageQueueWorker?.cleanupOldMessages) {
    setInterval(
      async () => {
        try {
          await messageQueueWorker.cleanupOldMessages(30);
        } catch (error) {
          console.error('❌ Error in queue cleanup cron:', error);
        }
      },
      24 * 60 * 60 * 1000
    );
  }

  // ✅ 5. **NEW: Process Scheduled Campaigns** (Every minute)
  setInterval(
    async () => {
      try {
        await processScheduledCampaigns();
      } catch (error) {
        console.error('❌ Error in scheduled campaigns cron:', error);
      }
    },
    60 * 1000 // Every 1 minute
  );

  console.log('✅ All cron jobs started (including scheduled campaigns)');
}

// ✅ NEW: Scheduled Campaign Processor
async function processScheduledCampaigns() {
  try {
    const now = new Date();

    // Find campaigns scheduled to start now or in the past
    const scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        scheduledAt: true,
      },
    });

    if (scheduledCampaigns.length === 0) {
      return; // No campaigns to process
    }

    console.log(`📅 Found ${scheduledCampaigns.length} scheduled campaigns to start`);

    // Import campaigns service dynamically
    const { campaignsService } = await import('./modules/campaigns/campaigns.service');

    for (const campaign of scheduledCampaigns) {
      try {
        console.log(`🚀 Auto-starting scheduled campaign: ${campaign.name} (${campaign.id})`);

        await campaignsService.start(campaign.organizationId, campaign.id);

        console.log(`✅ Successfully started campaign: ${campaign.name}`);
      } catch (error: any) {
        console.error(`❌ Failed to start campaign ${campaign.id}:`, error.message);

        // Mark campaign as failed if can't start
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error processing scheduled campaigns:', error);
  }
}

// ============================================
// START THE SERVER
// ============================================

bootstrap();