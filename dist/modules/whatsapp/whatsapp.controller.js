"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappController = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = require("./whatsapp.service");
const response_1 = require("../../utils/response");
const getOrgId = (req) => {
    const headerOrg = (req.header('X-Organization-Id') || req.header('x-organization-id'))?.trim() || '';
    const queryOrg = (typeof req.query.organizationId === 'string' ? req.query.organizationId : '')?.trim() || '';
    const userOrg = req.user?.organizationId?.trim?.() || '';
    return headerOrg || queryOrg || userOrg || null;
};
const sanitizeAccount = (account) => {
    const { accessToken, webhookSecret, ...safe } = account;
    return { ...safe, hasAccessToken: !!accessToken };
};
const verifyOrgAccess = async (userId, organizationId) => {
    const member = await database_1.default.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
    });
    return !!member;
};
class WhatsAppController {
    // ✅ GET /api/v1/whatsapp/accounts
    async getAccounts(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            if (!organizationId)
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok)
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            return (0, response_1.successResponse)(res, {
                data: accounts.map(sanitizeAccount),
                message: 'WhatsApp accounts retrieved',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ GET /api/v1/whatsapp/accounts/:accountId
    async getAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId)
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok)
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account)
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            return (0, response_1.successResponse)(res, {
                data: sanitizeAccount(account),
                message: 'WhatsApp account retrieved',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ POST /api/v1/whatsapp/accounts/:accountId/default
    async setDefaultAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId)
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok)
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account)
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            await database_1.default.whatsAppAccount.updateMany({
                where: { organizationId },
                data: { isDefault: false },
            });
            const updated = await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: { isDefault: true },
            });
            return (0, response_1.successResponse)(res, {
                data: sanitizeAccount(updated),
                message: 'Default WhatsApp account updated',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ DELETE /api/v1/whatsapp/accounts/:accountId
    async disconnectAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId)
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok)
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account)
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                    tokenExpiresAt: null,
                    isDefault: false,
                },
            });
            if (account.isDefault) {
                const another = await database_1.default.whatsAppAccount.findFirst({
                    where: {
                        organizationId,
                        id: { not: accountId },
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                    },
                    orderBy: { createdAt: 'desc' },
                });
                if (another) {
                    await database_1.default.whatsAppAccount.update({
                        where: { id: another.id },
                        data: { isDefault: true },
                    });
                }
            }
            return (0, response_1.successResponse)(res, {
                message: 'WhatsApp account disconnected successfully',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ------- EXISTING SEND APIs (unchanged) -------
    async sendText(req, res, next) {
        try {
            const { accountId, to, text, conversationId } = req.body;
            if (!accountId || !to || !text) {
                return (0, response_1.errorResponse)(res, 'Account ID, recipient, and text are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendTextMessage(accountId, to, text, conversationId);
            return (0, response_1.successResponse)(res, { data: result, message: 'Message sent successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async sendTemplate(req, res, next) {
        try {
            const { accountId, to, templateName, templateLanguage, components, conversationId } = req.body;
            if (!accountId || !to || !templateName) {
                return (0, response_1.errorResponse)(res, 'Account ID, recipient, and template name are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendTemplateMessage({
                accountId,
                to,
                templateName,
                templateLanguage: templateLanguage || 'en',
                components,
                conversationId,
            });
            return (0, response_1.successResponse)(res, { data: result, message: 'Template message sent successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async sendMedia(req, res, next) {
        try {
            const { accountId, to, mediaType, mediaUrl, caption, conversationId } = req.body;
            if (!accountId || !to || !mediaType || !mediaUrl) {
                return (0, response_1.errorResponse)(res, 'Account ID, recipient, media type, and media URL are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendMediaMessage(accountId, to, mediaType, mediaUrl, caption, conversationId);
            return (0, response_1.successResponse)(res, { data: result, message: 'Media message sent successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async markAsRead(req, res, next) {
        try {
            const { accountId, messageId } = req.body;
            if (!accountId || !messageId) {
                return (0, response_1.errorResponse)(res, 'Account ID and message ID are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.markAsRead(accountId, messageId);
            return (0, response_1.successResponse)(res, { data: result, message: 'Message marked as read' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.whatsappController = new WhatsAppController();
exports.default = exports.whatsappController;
//# sourceMappingURL=whatsapp.controller.js.map