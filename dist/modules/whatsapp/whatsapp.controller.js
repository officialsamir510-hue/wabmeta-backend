"use strict";
// src/modules/whatsapp/whatsapp.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappController = void 0;
const whatsapp_service_1 = require("./whatsapp.service");
const response_1 = require("../../utils/response");
class WhatsAppController {
    /**
     * Send text message
     */
    async sendText(req, res, next) {
        try {
            const { accountId, to, text, conversationId } = req.body;
            if (!accountId || !to || !text) {
                return (0, response_1.errorResponse)(res, 'Account ID, recipient, and text are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendTextMessage(accountId, to, text, conversationId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Message sent successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Send template message
     */
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
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Template message sent successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Send media message
     */
    async sendMedia(req, res, next) {
        try {
            const { accountId, to, mediaType, mediaUrl, caption, conversationId } = req.body;
            if (!accountId || !to || !mediaType || !mediaUrl) {
                return (0, response_1.errorResponse)(res, 'Account ID, recipient, media type, and media URL are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendMediaMessage(accountId, to, mediaType, mediaUrl, caption, conversationId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Media message sent successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark message as read
     */
    async markAsRead(req, res, next) {
        try {
            const { accountId, messageId } = req.body;
            if (!accountId || !messageId) {
                return (0, response_1.errorResponse)(res, 'Account ID and message ID are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.markAsRead(accountId, messageId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Message marked as read',
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.whatsappController = new WhatsAppController();
exports.default = exports.whatsappController;
//# sourceMappingURL=whatsapp.controller.js.map