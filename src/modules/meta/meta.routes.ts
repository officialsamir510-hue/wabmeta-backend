// 📁 src/modules/meta/meta.routes.ts - FINAL COMPLETE VERSION

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { metaService } from './meta.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhook)
// ============================================

/**
 * GET /webhook - Webhook verification
 * Required by Meta for webhook setup
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'your_verify_token';

  console.log('📞 Webhook verification request:', {
    mode,
    token: token ? '***' : 'missing',
    challenge: challenge ? 'present' : 'missing',
  });

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST /webhook - Handle incoming webhook events
 * Receives messages, status updates, etc.
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook event received:', JSON.stringify(req.body, null, 2));

    // Acknowledge receipt immediately
    res.sendStatus(200);

    // Process webhook asynchronously
    const { entry } = req.body;

    if (!entry || !Array.isArray(entry)) {
      console.warn('⚠️ Invalid webhook payload');
      return;
    }

    for (const item of entry) {
      const changes = item.changes || [];

      for (const change of changes) {
        if (change.field === 'messages') {
          const { messages, statuses } = change.value;

          // Handle incoming messages
          if (messages) {
            for (const message of messages) {
              console.log('📩 Incoming message:', message);
              // TODO: Process incoming message
              // await metaService.handleIncomingMessage(message);
            }
          }

          // Handle message statuses
          if (statuses) {
            for (const status of statuses) {
              console.log('📊 Message status:', status);
              // TODO: Update message status
              // await metaService.updateMessageStatus(status);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent Meta from retrying
    res.sendStatus(200);
  }
});

// ============================================
// PROTECTED ROUTES (Require Authentication)
// ============================================

router.use(authenticate);

// ============================================
// OAUTH & CONNECTION ROUTES
// ============================================

/**
 * GET /oauth-url - Get Meta OAuth URL for Embedded Signup
 * Query: ?organizationId=xxx
 */
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));

/**
 * GET /auth/url - Alias for /oauth-url
 */
router.get('/auth/url', metaController.getAuthUrl.bind(metaController));

/**
 * POST /initiate-connection - Alternative endpoint
 */
router.post('/initiate-connection', metaController.initiateConnection.bind(metaController));

/**
 * POST /callback - Handle OAuth callback
 * Body: { code, state }
 */
router.post('/callback', metaController.handleCallback.bind(metaController));

/**
 * POST /connect - Legacy connect endpoint
 * Body: { code, organizationId }
 */
router.post('/connect', metaController.handleCallback.bind(metaController));

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * GET /config - Get Embedded Signup configuration
 */
router.get('/config', metaController.getEmbeddedSignupConfig.bind(metaController));

/**
 * GET /integration-status - Get integration status
 */
router.get('/integration-status', metaController.getIntegrationStatus.bind(metaController));

// ============================================
// ORGANIZATION-BASED ROUTES
// ============================================

/**
 * GET /organizations/:organizationId/accounts
 * Get all WhatsApp accounts for an organization
 */
router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    console.log('📋 Fetching accounts for organization:', organizationId);

    // Verify user has access to organization
    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
        },
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }
    }

    const accounts = await metaService.getAccounts(organizationId);

    console.log(`✅ Found ${accounts.length} account(s)`);

    return sendSuccess(res, { accounts }, 'Accounts fetched successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /organizations/:organizationId/accounts/:accountId
 * Get single WhatsApp account
 */
router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    // Verify user has access
    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
        },
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }
    }

    const account = await metaService.getAccount(accountId, organizationId);

    return sendSuccess(res, account, 'Account fetched successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /organizations/:organizationId/accounts/:accountId
 * Disconnect WhatsApp account
 */
router.delete('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user has permission (OWNER or ADMIN only)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to disconnect accounts', 403);
    }

    console.log(`🔌 Disconnecting account ${accountId} from org ${organizationId}`);

    const result = await metaService.disconnectAccount(accountId, organizationId);

    return sendSuccess(res, result, 'Account disconnected successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations/:organizationId/accounts/:accountId/default
 * Set account as default for organization
 */
router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user has permission
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to set default account', 403);
    }

    console.log(`⭐ Setting account ${accountId} as default for org ${organizationId}`);

    const result = await metaService.setDefaultAccount(accountId, organizationId);

    return sendSuccess(res, result, 'Default account updated successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations/:organizationId/accounts/:accountId/sync-templates
 * Sync message templates for account
 */
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user has access
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to sync templates', 403);
    }

    console.log(`🔄 Syncing templates for account ${accountId}`);

    const result = await metaService.syncTemplates(accountId, organizationId);

    return sendSuccess(res, result, 'Templates synced successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations/:organizationId/accounts/:accountId/health
 * Refresh account health status
 */
router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user has access
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new AppError('You do not have access to this organization', 403);
    }

    console.log(`🏥 Checking health for account ${accountId}`);

    const result = await metaService.refreshAccountHealth(accountId, organizationId);

    return sendSuccess(res, result, 'Health check completed');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /organizations/:organizationId/status
 * Get organization connection status
 */
router.get('/organizations/:organizationId/status', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    // Verify user has access
    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
        },
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }
    }

    const accounts = await prisma.whatsAppAccount.findMany({
      where: {
        organizationId,
        status: 'CONNECTED',
      },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        isDefault: true,
        status: true,
        qualityRating: true,
      },
    });

    const status = accounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';

    return sendSuccess(res, {
      status,
      connectedCount: accounts.length,
      accounts,
    }, 'Organization status fetched');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations/:organizationId/sync
 * Sync all phone numbers for organization
 */
router.post('/organizations/:organizationId/sync', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user has permission
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to sync', 403);
    }

    console.log(`🔄 Syncing all accounts for org ${organizationId}`);

    // Get all connected accounts
    const accounts = await prisma.whatsAppAccount.findMany({
      where: {
        organizationId,
        status: 'CONNECTED',
      },
    });

    const results = [];
    for (const account of accounts) {
      try {
        const result = await metaService.syncTemplates(account.id, organizationId);
        results.push({
          accountId: account.id,
          success: true,
          ...result,
        });
      } catch (err: any) {
        results.push({
          accountId: account.id,
          success: false,
          error: err.message,
        });
      }
    }

    return sendSuccess(res, { results }, 'Sync completed');
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /organizations/:organizationId/disconnect
 * Disconnect all WhatsApp accounts for organization
 */
router.delete('/organizations/:organizationId/disconnect', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify user is OWNER
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: 'OWNER',
      },
    });

    if (!membership) {
      throw new AppError('Only organization owners can disconnect all accounts', 403);
    }

    console.log(`🔌 Disconnecting all accounts for org ${organizationId}`);

    // Disconnect all accounts
    await prisma.whatsAppAccount.updateMany({
      where: { organizationId },
      data: { status: 'DISCONNECTED' },
    });

    // Delete MetaConnection if exists
    try {
      await (prisma as any).metaConnection.delete({
        where: { organizationId },
      });
    } catch (e) {
      // MetaConnection might not exist
    }

    return sendSuccess(res, { success: true }, 'All accounts disconnected');
  } catch (error) {
    next(error);
  }
});

// ============================================
// HEADER-BASED ROUTES (Legacy support)
// ============================================

/**
 * GET /accounts - Get accounts using x-organization-id header
 */
router.get('/accounts', metaController.getAccounts.bind(metaController));

/**
 * GET /accounts/:id - Get single account
 */
router.get('/accounts/:id', metaController.getAccount.bind(metaController));

/**
 * DELETE /accounts/:id - Disconnect account
 */
router.delete('/accounts/:id', metaController.disconnectAccount.bind(metaController));

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /health - Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Meta Integration',
    version: 'v25.0',
    configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    timestamp: new Date().toISOString(),
  });
});

export default router;