// 📁 src/modules/meta/meta.routes.ts - COMPLETE WITH FIX

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { metaService } from './meta.service';
import { successResponse } from '../../utils/response';
import { config } from '../../config';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhook verification)
// ============================================

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
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
router.post('/connect', metaController.connect.bind(metaController));

// Configuration
router.get('/config', metaController.getEmbeddedSignupConfig.bind(metaController));
router.get('/integration-status', metaController.getIntegrationStatus.bind(metaController));

// ============================================
// ORGANIZATION ROUTES
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

// Organization status
router.get(
  '/organizations/:organizationId/status',
  metaController.getOrganizationStatus.bind(metaController)
);

// ============================================
// ACCOUNT MANAGEMENT ROUTES
// ============================================

// Get all accounts (alternative endpoint)
router.get('/accounts', metaController.getAccounts.bind(metaController));

// Get single account
router.get('/accounts/:id', metaController.getAccount.bind(metaController));

// Disconnect account
router.delete('/accounts/:id', metaController.disconnectAccount.bind(metaController));

// Set default account
router.post('/accounts/:id/default', metaController.setDefaultAccount.bind(metaController));

// Sync templates
router.post('/accounts/:id/sync-templates', metaController.syncTemplates.bind(metaController));

export default router;