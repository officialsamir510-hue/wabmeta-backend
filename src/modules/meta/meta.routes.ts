// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { tokenExchangeSchema, disconnectAccountSchema } from './meta.schema';

const router = Router();

// Public route - Embedded signup config
router.get('/config', metaController.getEmbeddedConfig.bind(metaController));

// Protected routes
router.use(authenticate);

// OAuth flow
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));
router.post(
  '/callback',
  validate(tokenExchangeSchema),
  metaController.handleCallback.bind(metaController)
);

// Account management
router.get(
  '/organizations/:organizationId/accounts',
  metaController.getAccounts.bind(metaController)
);

router.get(
  '/organizations/:organizationId/accounts/:accountId',
  metaController.getAccount.bind(metaController)
);

router.delete(
  '/organizations/:organizationId/accounts/:accountId',
  metaController.disconnectAccount.bind(metaController)
);

router.post(
  '/organizations/:organizationId/accounts/:accountId/default',
  metaController.setDefaultAccount.bind(metaController)
);

router.post(
  '/organizations/:organizationId/accounts/:accountId/health',
  metaController.refreshHealth.bind(metaController)
);

router.post(
  '/organizations/:organizationId/accounts/:accountId/sync-templates',
  metaController.syncTemplates.bind(metaController)
);

export default router;