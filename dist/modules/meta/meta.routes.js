"use strict";
// 📁 src/modules/meta/meta.routes.ts - COMPLETE FINAL VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller");
const auth_1 = require("../../middleware/auth");
const meta_service_1 = require("./meta.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES (Webhook) - BEFORE authenticate
// ============================================
/**
 * GET /webhook - Webhook verification
 */
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
    console.log('📞 Webhook verification request:', {
        mode,
        token: token ? '***' : 'missing',
        challenge: challenge ? 'present' : 'missing',
    });
    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    }
    else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});
/**
 * POST /webhook - Handle incoming webhook events
 */
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
        console.log(JSON.stringify(body, null, 2));
        // Acknowledge receipt immediately (Meta requirement)
        res.sendStatus(200);
        const entry = body?.entry;
        if (!Array.isArray(entry) || entry.length === 0) {
            console.warn('⚠️ Invalid webhook payload - no entries');
            return;
        }
        for (const item of entry) {
            const changes = item.changes || [];
            for (const change of changes) {
                const field = change.field;
                const value = change.value;
                // ✅ HANDLE MESSAGE STATUS UPDATES
                if (field === 'messages' && value.statuses && Array.isArray(value.statuses)) {
                    for (const statusUpdate of value.statuses) {
                        console.log('📦 WA STATUS UPDATE:', {
                            id: statusUpdate.id,
                            status: statusUpdate.status,
                            recipient_id: statusUpdate.recipient_id,
                            timestamp: statusUpdate.timestamp,
                            errors: statusUpdate.errors,
                        });
                        try {
                            let dbStatus = client_1.MessageStatus.SENT;
                            let deliveredAt;
                            let readAt;
                            let failedAt;
                            const metaStatus = statusUpdate.status;
                            const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);
                            switch (metaStatus) {
                                case 'sent':
                                    dbStatus = client_1.MessageStatus.SENT;
                                    break;
                                case 'delivered':
                                    dbStatus = client_1.MessageStatus.DELIVERED;
                                    deliveredAt = timestamp;
                                    break;
                                case 'read':
                                    dbStatus = client_1.MessageStatus.READ;
                                    readAt = timestamp;
                                    break;
                                case 'failed':
                                    dbStatus = client_1.MessageStatus.FAILED;
                                    failedAt = timestamp;
                                    break;
                                default:
                                    console.warn(`⚠️ Unknown status: ${metaStatus}`);
                            }
                            const failureReason = statusUpdate.errors?.[0]?.message || null;
                            const updateData = {
                                status: dbStatus,
                            };
                            if (deliveredAt)
                                updateData.deliveredAt = deliveredAt;
                            if (readAt)
                                updateData.readAt = readAt;
                            if (failedAt)
                                updateData.failedAt = failedAt;
                            if (failureReason)
                                updateData.failureReason = failureReason;
                            // Update Message
                            const updated = await database_1.default.message.updateMany({
                                where: {
                                    OR: [
                                        { wamId: statusUpdate.id },
                                        { waMessageId: statusUpdate.id },
                                    ],
                                },
                                data: updateData,
                            });
                            if (updated.count > 0) {
                                console.log(`✅ Updated ${updated.count} message(s) to status: ${dbStatus}`);
                                // Update CampaignContact
                                await database_1.default.campaignContact.updateMany({
                                    where: { waMessageId: statusUpdate.id },
                                    data: {
                                        status: dbStatus,
                                        deliveredAt,
                                        readAt,
                                        failedAt,
                                        failureReason,
                                    },
                                });
                            }
                            else {
                                console.warn(`⚠️ No message found with ID: ${statusUpdate.id}`);
                            }
                        }
                        catch (dbError) {
                            console.error('❌ DB update error:', dbError.message);
                        }
                    }
                }
                // ✅ HANDLE INCOMING MESSAGES
                if (field === 'messages' && value.messages && Array.isArray(value.messages)) {
                    for (const message of value.messages) {
                        console.log('📩 INCOMING MESSAGE:', {
                            id: message.id,
                            from: message.from,
                            type: message.type,
                            timestamp: message.timestamp,
                        });
                        // TODO: Process incoming message
                    }
                }
                // ✅ HANDLE TEMPLATE STATUS UPDATES
                if (field === 'message_template_status_update') {
                    console.log('📋 TEMPLATE STATUS UPDATE:', {
                        messageTemplateId: value.message_template_id,
                        messageTemplateName: value.message_template_name,
                        event: value.event,
                        reason: value.reason,
                    });
                    try {
                        const metaTemplateId = value.message_template_id?.toString();
                        if (metaTemplateId) {
                            let templateStatus = 'PENDING';
                            if (value.event === 'APPROVED')
                                templateStatus = 'APPROVED';
                            if (value.event === 'REJECTED')
                                templateStatus = 'REJECTED';
                            await database_1.default.template.updateMany({
                                where: { metaTemplateId },
                                data: {
                                    status: templateStatus,
                                    rejectionReason: value.reason || null,
                                },
                            });
                            console.log(`✅ Template ${metaTemplateId} updated to ${templateStatus}`);
                        }
                    }
                    catch (templateError) {
                        console.error('❌ Template update error:', templateError.message);
                    }
                }
            }
        }
        console.log('📨 ========== WEBHOOK PROCESSED ==========\n');
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.sendStatus(200);
    }
});
// ============================================
// PROTECTED ROUTES
// ============================================
router.use(auth_1.authenticate);
// ============================================
// OAUTH & CONNECTION ROUTES
// ============================================
router.get('/oauth-url', meta_controller_1.metaController.getOAuthUrl.bind(meta_controller_1.metaController));
router.get('/auth/url', meta_controller_1.metaController.getAuthUrl.bind(meta_controller_1.metaController));
router.post('/initiate-connection', meta_controller_1.metaController.initiateConnection.bind(meta_controller_1.metaController));
router.post('/callback', meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
router.post('/connect', meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
// ============================================
// CONFIGURATION ROUTES
// ============================================
router.get('/config', meta_controller_1.metaController.getEmbeddedSignupConfig.bind(meta_controller_1.metaController));
router.get('/integration-status', meta_controller_1.metaController.getIntegrationStatus.bind(meta_controller_1.metaController));
// ============================================
// ORGANIZATION-BASED ROUTES
// ============================================
router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        console.log('📋 Fetching accounts for organization:', organizationId);
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
            }
        }
        let accounts = [];
        try {
            accounts = await meta_service_1.metaService.getAccounts(organizationId);
        }
        catch (error) {
            console.warn('⚠️ metaService.getAccounts failed:', error.message);
            const whatsappAccounts = await database_1.default.whatsAppAccount.findMany({
                where: {
                    organizationId,
                    status: { in: ['CONNECTED', 'PENDING'] },
                },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            accounts = whatsappAccounts;
            try {
                const metaConnection = await database_1.default.metaConnection.findUnique({
                    where: { organizationId },
                    include: {
                        phoneNumbers: {
                            where: { isActive: true },
                            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
                        },
                    },
                });
                if (metaConnection && metaConnection.phoneNumbers?.length > 0) {
                    const metaAccounts = metaConnection.phoneNumbers.map((phone) => ({
                        id: phone.id,
                        organizationId,
                        phoneNumberId: phone.phoneNumberId,
                        phoneNumber: phone.phoneNumber,
                        displayName: phone.displayName || phone.verifiedName,
                        wabaId: metaConnection.wabaId,
                        status: metaConnection.status,
                        qualityRating: phone.qualityRating,
                        isDefault: phone.isPrimary,
                        createdAt: phone.createdAt,
                        updatedAt: phone.updatedAt,
                        source: 'MetaConnection',
                    }));
                    accounts = [...accounts, ...metaAccounts];
                }
            }
            catch (metaError) {
                console.log('⚠️ MetaConnection table not available');
            }
        }
        console.log(`✅ Found ${accounts.length} account(s)`);
        return (0, response_1.sendSuccess)(res, {
            accounts,
            total: accounts.length,
            hasConnected: accounts.some((a) => a.status === 'CONNECTED'),
        }, 'Accounts fetched successfully');
    }
    catch (error) {
        console.error('❌ Get accounts error:', error);
        next(error);
    }
});
router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
            }
        }
        const account = await meta_service_1.metaService.getAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, account, 'Account fetched successfully');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have permission to disconnect accounts', 403);
        }
        console.log(`🔌 Disconnecting account ${accountId} from org ${organizationId}`);
        const result = await meta_service_1.metaService.disconnectAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Account disconnected successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have permission to set default account', 403);
        }
        const result = await meta_service_1.metaService.setDefaultAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Default account updated successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have permission to sync templates', 403);
        }
        const result = await meta_service_1.metaService.syncTemplates(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Templates synced successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: { organizationId, userId },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have access to this organization', 403);
        }
        const result = await meta_service_1.metaService.refreshAccountHealth(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Health check completed');
    }
    catch (error) {
        next(error);
    }
});
router.get('/organizations/:organizationId/status', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
            }
        }
        const whatsappAccounts = await database_1.default.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' },
            select: {
                id: true,
                phoneNumber: true,
                displayName: true,
                isDefault: true,
                status: true,
                qualityRating: true,
                wabaId: true,
            },
        });
        let allAccounts = [...whatsappAccounts];
        let hasMetaConnection = false;
        try {
            const metaConnection = await database_1.default.metaConnection.findUnique({
                where: { organizationId },
                include: { phoneNumbers: { where: { isActive: true } } },
            });
            if (metaConnection && metaConnection.status === 'CONNECTED') {
                hasMetaConnection = true;
                if (metaConnection.phoneNumbers?.length > 0) {
                    const metaAccounts = metaConnection.phoneNumbers.map((phone) => ({
                        id: phone.id,
                        phoneNumber: phone.phoneNumber,
                        displayName: phone.displayName || phone.verifiedName,
                        isDefault: phone.isPrimary,
                        status: 'CONNECTED',
                        qualityRating: phone.qualityRating,
                        wabaId: metaConnection.wabaId,
                    }));
                    allAccounts = [...allAccounts, ...metaAccounts];
                }
            }
        }
        catch (e) {
            console.log('⚠️ MetaConnection table not available');
        }
        const status = allAccounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';
        return (0, response_1.sendSuccess)(res, {
            status,
            connectedCount: allAccounts.length,
            hasWhatsAppAccount: whatsappAccounts.length > 0,
            hasMetaConnection,
            accounts: allAccounts,
        }, 'Organization status fetched');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/sync', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have permission to sync', 403);
        }
        const accounts = await database_1.default.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' },
        });
        const results = [];
        for (const account of accounts) {
            try {
                const result = await meta_service_1.metaService.syncTemplates(account.id, organizationId);
                results.push({
                    accountId: account.id,
                    phoneNumber: account.phoneNumber,
                    success: true,
                    ...result,
                });
            }
            catch (err) {
                results.push({
                    accountId: account.id,
                    phoneNumber: account.phoneNumber,
                    success: false,
                    error: err.message,
                });
            }
        }
        return (0, response_1.sendSuccess)(res, { results, total: results.length }, 'Sync completed');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/organizations/:organizationId/disconnect', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: { organizationId, userId, role: 'OWNER' },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('Only organization owners can disconnect all accounts', 403);
        }
        const result = await database_1.default.whatsAppAccount.updateMany({
            where: { organizationId },
            data: { status: 'DISCONNECTED' },
        });
        try {
            await database_1.default.metaConnection.delete({ where: { organizationId } });
        }
        catch (e) {
            console.log('⚠️ No MetaConnection to delete');
        }
        return (0, response_1.sendSuccess)(res, { success: true, disconnectedCount: result.count }, 'All accounts disconnected successfully');
    }
    catch (error) {
        next(error);
    }
});
// ============================================
// HEADER-BASED ROUTES (Legacy)
// ============================================
router.get('/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
router.get('/accounts/:id', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
router.delete('/accounts/:id', meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Meta Integration',
        version: 'v25.0',
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        embeddedSignup: !!process.env.META_CONFIG_ID,
        webhookConfigured: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=meta.routes.js.map