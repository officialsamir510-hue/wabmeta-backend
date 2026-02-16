// 📁 src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { MetaController } from './meta.controller'; // Changed import
const metaController = new MetaController(); // Instantiate

import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { tokenExchangeSchema } from './meta.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Webhook verification (GET) - No auth needed
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

// Get embedded signup configuration
router.get('/config', metaController.getEmbeddedSignupConfig.bind(metaController));

// Get integration status
router.get('/status', metaController.getIntegrationStatus.bind(metaController));

// ============================================
// PROTECTED ROUTES (Requires Authentication)
// ============================================

router.use(authenticate);

// OAuth URL generation (primary route)
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));

// Backward-compatible alias for frontend that uses /meta/auth/url
router.get('/auth/url', metaController.getOAuthUrl.bind(metaController));

// OAuth callback handler (primary route)
router.post(
  '/callback',
  validate(tokenExchangeSchema),
  metaController.handleCallback.bind(metaController)
);

// Connect via token/code directly
router.post(
  '/connect',
  validate(tokenExchangeSchema),
  metaController.connect.bind(metaController)
);

// ============================================
// ORGANIZATION ROUTES
// ============================================

// Get organization connection status
router.get(
  '/organizations/:organizationId/status',
  metaController.getOrganizationStatus.bind(metaController)
);

// Get all accounts for organization
router.get(
  '/organizations/:organizationId/accounts',
  metaController.getAccounts.bind(metaController)
);

// Get single account
router.get(
  '/organizations/:organizationId/accounts/:accountId',
  metaController.getAccount.bind(metaController)
);

// Disconnect account
router.delete(
  '/organizations/:organizationId/accounts/:accountId',
  metaController.disconnectAccount.bind(metaController)
);

// Set default account
router.post(
  '/organizations/:organizationId/accounts/:accountId/default',
  metaController.setDefaultAccount.bind(metaController)
);

// Refresh account health
router.post(
  '/organizations/:organizationId/accounts/:accountId/health',
  metaController.refreshHealth.bind(metaController)
);

// Sync templates
router.post(
  '/organizations/:organizationId/accounts/:accountId/sync-templates',
  metaController.syncTemplates.bind(metaController)
);

export default router;