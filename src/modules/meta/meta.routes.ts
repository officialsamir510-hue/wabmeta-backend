// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { tokenExchangeSchema } from './meta.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Get embedded signup configuration
router.get('/config', metaController.getEmbeddedConfig.bind(metaController));

// Get integration status
router.get('/status', metaController.getStatus.bind(metaController));

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

// Backward-compatible alias for frontend that uses /meta/connect
router.post(
  '/connect',
  validate(tokenExchangeSchema),
  metaController.handleCallback.bind(metaController)
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

// ============================================
// DANGER ZONE - Development/Debug Routes
// ============================================

// ⚠️ DANGEROUS: Reset all Meta connections and data for organization
// This will delete all WhatsApp accounts, templates, campaigns, messages, etc.
// Use only for development/debugging
if (process.env.NODE_ENV !== 'production') {
  router.post('/reset-account', metaController.resetAccount.bind(metaController));
  router.post('/force-disconnect-all', metaController.forceDisconnectAll.bind(metaController));
} else {
  // In production, require special header or admin role
  router.post('/reset-account',
    (req, res, next) => {
      // Add extra security check for production
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({
          success: false,
          message: 'This operation requires admin privileges'
        });
      }
      next();
    },
    metaController.resetAccount.bind(metaController)
  );
}

export default router;