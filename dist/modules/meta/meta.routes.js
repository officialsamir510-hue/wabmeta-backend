"use strict";
// 📁 src/modules/meta/meta.routes.ts - COMPLETE WITH ALL ORG ROUTES
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller");
const auth_1 = require("../../middleware/auth");
const meta_service_1 = require("./meta.service");
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
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
    }
    else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});
// ============================================
// PROTECTED ROUTES
// ============================================
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
// ============================================
// ORGANIZATION ROUTES (Frontend uses these)
// ============================================
// Get organization's WhatsApp accounts
router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const accounts = await meta_service_1.metaService.getAccounts(organizationId);
        return (0, response_1.successResponse)(res, { data: accounts, message: 'Accounts fetched' });
    }
    catch (error) {
        next(error);
    }
});
// Get single organization account
router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const account = await meta_service_1.metaService.getAccount(accountId, organizationId);
        return (0, response_1.successResponse)(res, { data: account, message: 'Account fetched' });
    }
    catch (error) {
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
        const membership = await database_1.default.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
        });
        if (!membership) {
            throw new Error('You do not have permission to disconnect');
        }
        const result = await meta_service_1.metaService.disconnectAccount(accountId, organizationId);
        return (0, response_1.successResponse)(res, { data: result, message: 'Account disconnected' });
    }
    catch (error) {
        next(error);
    }
});
// Set organization's default account
router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const result = await meta_service_1.metaService.setDefaultAccount(accountId, organizationId);
        return (0, response_1.successResponse)(res, { data: result, message: 'Default account updated' });
    }
    catch (error) {
        next(error);
    }
});
// Sync organization account templates
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const result = await meta_service_1.metaService.syncTemplates(accountId, organizationId);
        return (0, response_1.successResponse)(res, { data: result, message: 'Templates synced' });
    }
    catch (error) {
        next(error);
    }
});
// Refresh organization account health
router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const result = await meta_service_1.metaService.refreshAccountHealth(accountId, organizationId);
        return (0, response_1.successResponse)(res, { data: result, message: 'Health check completed' });
    }
    catch (error) {
        next(error);
    }
});
// Organization status
router.get('/organizations/:organizationId/status', meta_controller_1.metaController.getOrganizationStatus.bind(meta_controller_1.metaController));
// ============================================
// ACCOUNT MANAGEMENT ROUTES (Header-based)
// ============================================
// Get all accounts (alternative endpoint)
router.get('/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
// Get single account
router.get('/accounts/:id', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
// Disconnect account
router.delete('/accounts/:id', meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
// Set default account
router.post('/accounts/:id/default', meta_controller_1.metaController.setDefaultAccount.bind(meta_controller_1.metaController));
// Sync templates
router.post('/accounts/:id/sync-templates', meta_controller_1.metaController.syncTemplates.bind(meta_controller_1.metaController));
exports.default = router;
//# sourceMappingURL=meta.routes.js.map