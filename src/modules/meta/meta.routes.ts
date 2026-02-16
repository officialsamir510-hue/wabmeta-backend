// 📁 src/modules/meta/meta.routes.ts - COMPLETE FIXED VERSION

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhook verification)
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

// ============================================
// PROTECTED ROUTES
// ============================================

// Apply auth middleware to all routes below
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

// Organization status
router.get(
  '/organizations/:organizationId/status',
  metaController.getOrganizationStatus.bind(metaController)
);

// Account management
router.get('/accounts', metaController.getAccounts.bind(metaController));
router.get('/accounts/:id', metaController.getAccount.bind(metaController));
router.delete('/accounts/:id', metaController.disconnectAccount.bind(metaController));
router.post('/accounts/:id/default', metaController.setDefaultAccount.bind(metaController));
router.post('/accounts/:id/sync-templates', metaController.syncTemplates.bind(metaController));

export default router;