// 📁 src/modules/meta/meta.routes.ts - COMPLETE WITH ALL ORG ROUTES

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { metaService } from './meta.service';
import { successResponse } from '../../utils/response';
import prisma from '../../config/database';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhook verification)
// ============================================

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// ============================================
// PROTECTED ROUTES
// ============================================

router.use(authenticate);

// OAuth URLs
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));
router.get('/auth/url', metaController.getAuthUrl.bind(metaController));

// Callback & Connect
router.post('/callback', metaController.handleCallback.bind(metaController));

// Configuration
router.get('/config', metaController.getEmbeddedSignupConfig.bind(metaController));
router.get('/integration-status', metaController.getIntegrationStatus.bind(metaController));

// ============================================
// ORGANIZATION ROUTES (Frontend uses these)
// ============================================

// Get organization's WhatsApp accounts
router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    const accounts = await metaService.getAccounts(organizationId);

    return successResponse(res, { data: accounts, message: 'Accounts fetched' });
  } catch (error) {
    next(error);
  }
});

// Get single organization account
router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;

    const account = await metaService.getAccount(accountId, organizationId);

    return successResponse(res, { data: account, message: 'Account fetched' });
  } catch (error) {
    next(error);
  }
});

// Disconnect organization's WhatsApp account
router.delete('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new Error('Authentication required');
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
      throw new Error('You do not have permission to disconnect');
    }

    const result = await metaService.disconnectAccount(accountId, organizationId);

    return successResponse(res, { data: result, message: 'Account disconnected' });
  } catch (error) {
    next(error);
  }
});

// Set organization's default account
router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;

    const result = await metaService.setDefaultAccount(accountId, organizationId);

    return successResponse(res, { data: result, message: 'Default account updated' });
  } catch (error) {
    next(error);
  }
});

// Sync organization account templates
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;

    const result = await metaService.syncTemplates(accountId, organizationId);

    return successResponse(res, { data: result, message: 'Templates synced' });
  } catch (error) {
    next(error);
  }
});

// Refresh organization account health
router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;

    const result = await metaService.refreshAccountHealth(accountId, organizationId);

    return successResponse(res, { data: result, message: 'Health check completed' });
  } catch (error) {
    next(error);
  }
});

// Organization status
// Removed as getOrganizationStatus relies on deleted controller method
// router.get(
//   '/organizations/:organizationId/status',
//   metaController.getOrganizationStatus.bind(metaController)
// );

// ============================================
// ACCOUNT MANAGEMENT ROUTES (Header-based)
// ============================================

// Get all accounts (alternative endpoint)
router.get('/accounts', metaController.getAccounts.bind(metaController));

// Get single account
router.get('/accounts/:id', metaController.getAccount.bind(metaController));

// Disconnect account
router.delete('/accounts/:id', metaController.disconnectAccount.bind(metaController));

export default router;