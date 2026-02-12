import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { tokenExchangeSchema } from './meta.schema';

const router = Router();

// Public
router.get('/config', metaController.getEmbeddedConfig.bind(metaController));
router.get('/status', metaController.getStatus.bind(metaController));

// Protected
router.use(authenticate);

// OAuth URL (primary)
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));

// Backward-compatible alias (your frontend api.ts had /meta/auth/url)
router.get('/auth/url', metaController.getOAuthUrl.bind(metaController));

// Callback (primary)
router.post(
  '/callback',
  validate(tokenExchangeSchema),
  metaController.handleCallback.bind(metaController)
);

// Backward-compatible alias (some frontend code uses /meta/connect)
router.post(
  '/connect',
  validate(tokenExchangeSchema),
  metaController.handleCallback.bind(metaController)
);

// Account management
router.get('/organizations/:organizationId/accounts', metaController.getAccounts.bind(metaController));
router.get('/organizations/:organizationId/accounts/:accountId', metaController.getAccount.bind(metaController));
router.delete('/organizations/:organizationId/accounts/:accountId', metaController.disconnectAccount.bind(metaController));
router.post('/organizations/:organizationId/accounts/:accountId/default', metaController.setDefaultAccount.bind(metaController));
router.post('/organizations/:organizationId/accounts/:accountId/health', metaController.refreshHealth.bind(metaController));
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', metaController.syncTemplates.bind(metaController));

export default router;