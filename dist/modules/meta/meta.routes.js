"use strict";
// 📁 src/modules/meta/meta.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller"); // Changed import
const metaController = new meta_controller_1.MetaController(); // Instantiate
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const meta_schema_1 = require("./meta.schema");
const router = (0, express_1.Router)();
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
    }
    else {
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
router.use(auth_1.authenticate);
// OAuth URL generation (primary route)
router.get('/oauth-url', metaController.getOAuthUrl.bind(metaController));
// Backward-compatible alias for frontend that uses /meta/auth/url
router.get('/auth/url', metaController.getOAuthUrl.bind(metaController));
// OAuth callback handler (primary route)
router.post('/callback', (0, validate_1.validate)(meta_schema_1.tokenExchangeSchema), metaController.handleCallback.bind(metaController));
// Connect via token/code directly
router.post('/connect', (0, validate_1.validate)(meta_schema_1.tokenExchangeSchema), metaController.connect.bind(metaController));
// ============================================
// ORGANIZATION ROUTES
// ============================================
// Get organization connection status
router.get('/organizations/:organizationId/status', metaController.getOrganizationStatus.bind(metaController));
// Get all accounts for organization
router.get('/organizations/:organizationId/accounts', metaController.getAccounts.bind(metaController));
// Get single account
router.get('/organizations/:organizationId/accounts/:accountId', metaController.getAccount.bind(metaController));
// Disconnect account
router.delete('/organizations/:organizationId/accounts/:accountId', metaController.disconnectAccount.bind(metaController));
// Set default account
router.post('/organizations/:organizationId/accounts/:accountId/default', metaController.setDefaultAccount.bind(metaController));
// Refresh account health
router.post('/organizations/:organizationId/accounts/:accountId/health', metaController.refreshHealth.bind(metaController));
// Sync templates
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', metaController.syncTemplates.bind(metaController));
exports.default = router;
//# sourceMappingURL=meta.routes.js.map