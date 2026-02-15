"use strict";
// src/modules/meta/meta.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const meta_schema_1 = require("./meta.schema");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES
// ============================================
// Get embedded signup configuration
router.get('/config', meta_controller_1.metaController.getEmbeddedConfig.bind(meta_controller_1.metaController));
// Get integration status
router.get('/status', meta_controller_1.metaController.getStatus.bind(meta_controller_1.metaController));
// ============================================
// PROTECTED ROUTES (Requires Authentication)
// ============================================
router.use(auth_1.authenticate);
// OAuth URL generation (primary route)
router.get('/oauth-url', meta_controller_1.metaController.getOAuthUrl.bind(meta_controller_1.metaController));
// Backward-compatible alias for frontend that uses /meta/auth/url
router.get('/auth/url', meta_controller_1.metaController.getOAuthUrl.bind(meta_controller_1.metaController));
// OAuth callback handler (primary route)
router.post('/callback', (0, validate_1.validate)(meta_schema_1.tokenExchangeSchema), meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
// Backward-compatible alias for frontend that uses /meta/connect
router.post('/connect', (0, validate_1.validate)(meta_schema_1.tokenExchangeSchema), meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
// ============================================
// DEBUG ROUTES
// ============================================
// Debug single account token
router.get('/debug-token/:accountId', meta_controller_1.metaController.debugToken.bind(meta_controller_1.metaController));
// Debug all accounts for organization
router.get('/debug-all/:organizationId', meta_controller_1.metaController.debugAllTokens.bind(meta_controller_1.metaController));
// ============================================
// ORGANIZATION ROUTES
// ============================================
// Get organization connection status
router.get('/organizations/:organizationId/status', meta_controller_1.metaController.getOrganizationStatus.bind(meta_controller_1.metaController));
// Get all accounts for organization
router.get('/organizations/:organizationId/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
// Get single account
router.get('/organizations/:organizationId/accounts/:accountId', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
// Disconnect account
router.delete('/organizations/:organizationId/accounts/:accountId', meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
// Set default account
router.post('/organizations/:organizationId/accounts/:accountId/default', meta_controller_1.metaController.setDefaultAccount.bind(meta_controller_1.metaController));
// Refresh account health
router.post('/organizations/:organizationId/accounts/:accountId/health', meta_controller_1.metaController.refreshHealth.bind(meta_controller_1.metaController));
// Sync templates
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', meta_controller_1.metaController.syncTemplates.bind(meta_controller_1.metaController));
// ============================================
// DANGER ZONE - Development/Debug Routes
// ============================================
// ⚠️ DANGEROUS: Reset all Meta connections and data for organization
// This will delete all WhatsApp accounts, templates, campaigns, messages, etc.
// Use only for development/debugging
if (process.env.NODE_ENV !== 'production') {
    router.post('/reset-account', meta_controller_1.metaController.resetAccount.bind(meta_controller_1.metaController));
    router.post('/force-disconnect-all', meta_controller_1.metaController.forceDisconnectAll.bind(meta_controller_1.metaController));
}
else {
    // In production, require special header or admin role
    router.post('/reset-account', (req, res, next) => {
        // Add extra security check for production
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({
                success: false,
                message: 'This operation requires admin privileges'
            });
        }
        next();
    }, meta_controller_1.metaController.resetAccount.bind(meta_controller_1.metaController));
}
exports.default = router;
//# sourceMappingURL=meta.routes.js.map