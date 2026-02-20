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
// ============================================
// HELPER FUNCTIONS
// ============================================
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
// ============================================
// WHATSAPP CONTROLLER CLASS
// ============================================
class WhatsAppController {
    // ============================================
    // ACCOUNT MANAGEMENT
    // ============================================
    // ✅ GET /api/v1/whatsapp/accounts
    async getAccounts(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
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
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
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
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
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
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
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
    // ============================================
    // MESSAGE SENDING APIs - ✅ FIXED
    // ============================================
    /**
     * ✅ FIXED: Send Text Message
     * Accepts multiple field name formats for flexibility
     */
    async sendText(req, res, next) {
        try {
            // ✅ Support multiple field name formats from frontend
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const to = req.body.to || req.body.recipient || req.body.phone;
            const text = req.body.text || req.body.message || req.body.content;
            const conversationId = req.body.conversationId;
            // Log incoming request for debugging
            console.log('📤 Send Text Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                to: to ? `${to.substring(0, 6)}***` : null,
                textLength: text?.length || 0,
                hasConversationId: !!conversationId,
                rawBody: {
                    hasAccountId: !!req.body.accountId,
                    hasWhatsappAccountId: !!req.body.whatsappAccountId,
                    hasTo: !!req.body.to,
                    hasRecipient: !!req.body.recipient,
                    hasText: !!req.body.text,
                    hasMessage: !!req.body.message,
                }
            });
            // Validate accountId
            if (!accountId) {
                console.error('❌ Missing accountId. Received body keys:', Object.keys(req.body));
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            // Validate recipient
            if (!to) {
                console.error('❌ Missing recipient. Received body keys:', Object.keys(req.body));
                return (0, response_1.errorResponse)(res, 'Recipient phone number is required. Send as "to", "recipient", or "phone"', 400);
            }
            // Validate text
            if (!text || (typeof text === 'string' && text.trim().length === 0)) {
                console.error('❌ Missing text. Received body keys:', Object.keys(req.body));
                return (0, response_1.errorResponse)(res, 'Message text is required. Send as "text", "message", or "content"', 400);
            }
            // Clean the text
            const cleanText = typeof text === 'string' ? text.trim() : String(text);
            // Send message via service
            const result = await whatsapp_service_1.whatsappService.sendTextMessage(accountId, to, cleanText, conversationId);
            console.log('✅ Text message sent successfully:', {
                messageId: result?.messageId || 'N/A',
            });
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Message sent successfully',
            });
        }
        catch (error) {
            console.error('❌ Send text error:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3),
            });
            next(error);
        }
    }
    /**
     * ✅ FIXED: Send Template Message
     * Accepts multiple field name formats for flexibility
     */
    async sendTemplate(req, res, next) {
        try {
            // ✅ Support multiple field name formats
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const to = req.body.to || req.body.recipient || req.body.phone;
            const templateName = req.body.templateName || req.body.template_name || req.body.name;
            const templateLanguage = req.body.templateLanguage || req.body.languageCode || req.body.language || 'en';
            const components = req.body.components || req.body.parameters || [];
            const conversationId = req.body.conversationId;
            // Log incoming request
            console.log('📋 Send Template Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                to: to ? `${to.substring(0, 6)}***` : null,
                templateName,
                templateLanguage,
                componentsCount: components?.length || 0,
                hasConversationId: !!conversationId,
            });
            // Validate accountId
            if (!accountId) {
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            // Validate recipient
            if (!to) {
                return (0, response_1.errorResponse)(res, 'Recipient phone number is required. Send as "to", "recipient", or "phone"', 400);
            }
            // Validate template name
            if (!templateName) {
                return (0, response_1.errorResponse)(res, 'Template name is required. Send as "templateName", "template_name", or "name"', 400);
            }
            // Send template via service
            const result = await whatsapp_service_1.whatsappService.sendTemplateMessage({
                accountId,
                to,
                templateName,
                templateLanguage,
                components,
                conversationId,
            });
            console.log('✅ Template message sent successfully:', {
                messageId: result?.messageId || 'N/A',
            });
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Template message sent successfully',
            });
        }
        catch (error) {
            console.error('❌ Send template error:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3),
            });
            next(error);
        }
    }
    /**
     * ✅ FIXED: Send Media Message
     * Accepts multiple field name formats for flexibility
     */
    async sendMedia(req, res, next) {
        try {
            // ✅ Support multiple field name formats
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const to = req.body.to || req.body.recipient || req.body.phone;
            const mediaType = req.body.mediaType || req.body.media_type || req.body.type;
            const mediaUrl = req.body.mediaUrl || req.body.media_url || req.body.url;
            const caption = req.body.caption || req.body.text || '';
            const conversationId = req.body.conversationId;
            // Log incoming request
            console.log('🖼️ Send Media Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                to: to ? `${to.substring(0, 6)}***` : null,
                mediaType,
                mediaUrl: mediaUrl ? `${mediaUrl.substring(0, 30)}...` : null,
                hasCaption: !!caption,
                hasConversationId: !!conversationId,
            });
            // Validate accountId
            if (!accountId) {
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            // Validate recipient
            if (!to) {
                return (0, response_1.errorResponse)(res, 'Recipient phone number is required. Send as "to", "recipient", or "phone"', 400);
            }
            // Validate media type
            const validMediaTypes = ['image', 'video', 'audio', 'document'];
            if (!mediaType || !validMediaTypes.includes(mediaType.toLowerCase())) {
                return (0, response_1.errorResponse)(res, `Media type is required and must be one of: ${validMediaTypes.join(', ')}`, 400);
            }
            // Validate media URL
            if (!mediaUrl) {
                return (0, response_1.errorResponse)(res, 'Media URL is required. Send as "mediaUrl", "media_url", or "url"', 400);
            }
            // Send media via service
            const result = await whatsapp_service_1.whatsappService.sendMediaMessage(accountId, to, mediaType.toLowerCase(), mediaUrl, caption, conversationId);
            console.log('✅ Media message sent successfully:', {
                messageId: result?.messageId || 'N/A',
            });
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Media message sent successfully',
            });
        }
        catch (error) {
            console.error('❌ Send media error:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3),
            });
            next(error);
        }
    }
    /**
     * ✅ FIXED: Mark Message as Read
     */
    async markAsRead(req, res, next) {
        try {
            // Support multiple field name formats
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const messageId = req.body.messageId || req.body.message_id || req.body.wamId;
            console.log('👁️ Mark as Read Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                messageId,
            });
            if (!accountId) {
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            if (!messageId) {
                return (0, response_1.errorResponse)(res, 'Message ID is required. Send as "messageId", "message_id", or "wamId"', 400);
            }
            const result = await whatsapp_service_1.whatsappService.markAsRead(accountId, messageId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Message marked as read',
            });
        }
        catch (error) {
            console.error('❌ Mark as read error:', error.message);
            next(error);
        }
    }
}
// ============================================
// EXPORT
// ============================================
exports.whatsappController = new WhatsAppController();
exports.default = exports.whatsappController;
//# sourceMappingURL=whatsapp.controller.js.map