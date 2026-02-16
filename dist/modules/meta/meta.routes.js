"use strict";
// 📁 src/modules/meta/meta.routes.ts - COMPLETE FIXED VERSION
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
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
    }
    else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});
// ============================================
// PROTECTED ROUTES
// ============================================
// Apply auth middleware to all routes below
router.use(auth_1.authenticate);
// OAuth URLs
router.get('/oauth-url', meta_controller_1.metaController.getOAuthUrl.bind(meta_controller_1.metaController));
router.get('/auth/url', meta_controller_1.metaController.getAuthUrl.bind(meta_controller_1.metaController));
// Callback & Connect
router.post('/callback', meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
router.post('/connect', meta_controller_1.metaController.connect.bind(meta_controller_1.metaController));
// Configuration
router.get('/config', meta_controller_1.metaController.getEmbeddedSignupConfig.bind(meta_controller_1.metaController));
router.get('/integration-status', meta_controller_1.metaController.getIntegrationStatus.bind(meta_controller_1.metaController));
// Organization status
router.get('/organizations/:organizationId/status', meta_controller_1.metaController.getOrganizationStatus.bind(meta_controller_1.metaController));
// Account management
router.get('/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
router.get('/accounts/:id', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
router.delete('/accounts/:id', meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
router.post('/accounts/:id/default', meta_controller_1.metaController.setDefaultAccount.bind(meta_controller_1.metaController));
router.post('/accounts/:id/sync-templates', meta_controller_1.metaController.syncTemplates.bind(meta_controller_1.metaController));
exports.default = router;
//# sourceMappingURL=meta.routes.js.map