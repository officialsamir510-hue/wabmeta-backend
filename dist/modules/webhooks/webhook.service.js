"use strict";
// 📁 src/modules/webhooks/webhook.service.ts - FIXED (NO DUPLICATE CONTACTS ON REPLY)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = exports.webhookEvents = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("../../config");
const encryption_1 = require("../../utils/encryption");
const meta_api_1 = require("../meta/meta.api");
const events_1 = require("events");
const phone_1 = require("../../utils/phone");
exports.webhookEvents = new events_1.EventEmitter();
exports.webhookEvents.setMaxListeners(20);
const database_1 = __importDefault(require("../../config/database"));
// ============================================
// WEBHOOK SERVICE CLASS
// ============================================
class WebhookService {
    verifyWebhook(mode, token, challenge) {
        const verifyToken = config_1.config.meta.webhookVerifyToken;
        if (mode === 'subscribe' && token === verifyToken)
            return challenge;
        return null;
    }
    async processWebhook(payload, signature) {
        const startTime = Date.now();
        const webhookLog = await database_1.default.webhookLog.create({
            data: {
                source: 'META',
                eventType: payload?.object || 'unknown',
                payload,
                status: client_1.WebhookStatus.PROCESSING,
            },
        });
        try {
            if (config_1.config.app.isProduction && signature) {
                const isValid = (0, encryption_1.verifyWebhookSignature)(JSON.stringify(payload), signature, config_1.config.meta.appSecret);
                if (!isValid) {
                    await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.FAILED, 'Invalid signature');
                    return { success: false, processed: 0 };
                }
            }
            if (payload?.object !== 'whatsapp_business_account') {
                await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.SUCCESS);
                return { success: true, processed: 0 };
            }
            let processedCount = 0;
            for (const entry of payload.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field !== 'messages')
                        continue;
                    const value = change.value;
                    const phoneNumberId = value.metadata?.phone_number_id;
                    const account = await database_1.default.whatsAppAccount.findFirst({
                        where: { phoneNumberId },
                    });
                    if (!account)
                        continue;
                    await database_1.default.webhookLog.update({
                        where: { id: webhookLog.id },
                        data: { organizationId: account.organizationId },
                    });
                    if (value.messages) {
                        for (const message of value.messages) {
                            await this.processIncomingMessage(account, message, value.contacts);
                            processedCount++;
                        }
                    }
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            await this.processMessageStatus(account, status);
                            processedCount++;
                        }
                    }
                }
            }
            const duration = Date.now() - startTime;
            await database_1.default.webhookLog.update({
                where: { id: webhookLog.id },
                data: { status: client_1.WebhookStatus.SUCCESS, processedAt: new Date(), responseTime: duration },
            });
            return { success: true, processed: processedCount };
        }
        catch (error) {
            await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.FAILED, error.message);
            return { success: false, processed: 0 };
        }
    }
    // ============================================
    // PROCESS INCOMING MESSAGE ✅ FIXED CONTACT LOOKUP
    // ============================================
    async processIncomingMessage(account, message, contacts) {
        try {
            const waFrom = String(message.from || '').trim(); // usually "91xxxxxxxxxx"
            const variants = (0, phone_1.buildINPhoneVariants)(waFrom);
            const contactInfo = contacts?.find((c) => String(c.wa_id) === waFrom);
            const contactName = contactInfo?.profile?.name;
            // ✅ Find contact across all legacy formats
            let contact = await database_1.default.contact.findFirst({
                where: {
                    organizationId: account.organizationId,
                    OR: variants.map((p) => ({ phone: p })),
                },
            });
            // ✅ Create canonical (phone=10digit) if not found
            if (!contact) {
                const phone10 = (0, phone_1.normalizeINNational10)(waFrom);
                if (!phone10) {
                    // If WhatsApp sends something unexpected, skip contact creation safely
                    console.warn('⚠️ Invalid inbound phone, skipping contact create:', waFrom);
                    return;
                }
                contact = await database_1.default.contact.create({
                    data: {
                        organizationId: account.organizationId,
                        phone: phone10, // ✅ canonical
                        countryCode: '+91',
                        firstName: contactName || 'Unknown',
                        source: 'WHATSAPP',
                        status: 'ACTIVE',
                    },
                });
            }
            // Conversation
            let conversation = await database_1.default.conversation.findFirst({
                where: { organizationId: account.organizationId, contactId: contact.id },
            });
            const now = new Date();
            const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organizationId: account.organizationId,
                        contactId: contact.id,
                        lastMessageAt: now,
                        lastMessagePreview: this.getMessagePreview(message),
                        lastCustomerMessageAt: now,
                        windowExpiresAt: windowExpiry,
                        isWindowOpen: true,
                        unreadCount: 1,
                        isRead: false,
                    },
                });
            }
            else {
                await database_1.default.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        lastMessageAt: now,
                        lastMessagePreview: this.getMessagePreview(message),
                        lastCustomerMessageAt: now,
                        windowExpiresAt: windowExpiry,
                        isWindowOpen: true,
                        unreadCount: { increment: 1 },
                        isRead: false,
                        isArchived: false,
                    },
                });
            }
            // Duplicate message protection
            const existingMessage = await database_1.default.message.findFirst({
                where: { waMessageId: message.id },
            });
            if (existingMessage)
                return;
            // Create message
            const messageData = await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId: account.id,
                    waMessageId: message.id,
                    wamId: message.id,
                    direction: client_1.MessageDirection.INBOUND,
                    type: this.mapMessageType(message.type),
                    content: this.extractMessageContent(message),
                    mediaUrl: await this.getMediaUrl(account, message),
                    mediaType: message.type !== 'text' ? message.type : null,
                    status: client_1.MessageStatus.DELIVERED,
                    sentAt: new Date(parseInt(message.timestamp) * 1000),
                    replyToMessageId: message.context?.id || null,
                    metadata: { originalType: message.type, context: message.context || null },
                },
            });
            exports.webhookEvents.emit('newMessage', { ...messageData, organizationId: account.organizationId });
            // Update contact stats
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: { lastMessageAt: now, messageCount: { increment: 1 } },
            });
        }
        catch (error) {
            console.error('❌ Error processing incoming message:', error);
        }
    }
    // ============================================
    // STATUS UPDATES (same as your current logic)
    // ============================================
    async processMessageStatus(account, status) {
        try {
            const message = await database_1.default.message.findFirst({
                where: { OR: [{ waMessageId: status.id }, { wamId: status.id }] },
            });
            if (!message) {
                await this.updateCampaignContactStatus(status);
                return;
            }
            const timestamp = new Date(parseInt(status.timestamp) * 1000);
            const updateData = {
                status: this.mapStatus(status.status),
                statusUpdatedAt: timestamp,
            };
            switch (status.status) {
                case 'sent':
                    updateData.sentAt = timestamp;
                    break;
                case 'delivered':
                    updateData.deliveredAt = timestamp;
                    break;
                case 'read':
                    updateData.readAt = timestamp;
                    break;
                case 'failed':
                    updateData.failedAt = timestamp;
                    updateData.failureReason = status.errors?.[0]?.message || status.errors?.[0]?.title || 'Unknown error';
                    break;
            }
            await database_1.default.message.update({ where: { id: message.id }, data: updateData });
            if (status.conversation?.expiration_timestamp) {
                await database_1.default.conversation.update({
                    where: { id: message.conversationId },
                    data: {
                        windowExpiresAt: new Date(parseInt(status.conversation.expiration_timestamp) * 1000),
                        isWindowOpen: true,
                    },
                }).catch(() => { });
            }
            exports.webhookEvents.emit('messageStatus', {
                messageId: message.id,
                waMessageId: status.id,
                status: this.mapStatus(status.status),
                organizationId: account.organizationId,
                conversationId: message.conversationId,
            });
        }
        catch (error) {
            console.error('❌ Error processing status update:', error.message);
        }
    }
    async updateCampaignContactStatus(status) {
        try {
            const timestamp = new Date(parseInt(status.timestamp) * 1000);
            const mappedStatus = this.mapStatus(status.status);
            const updateData = { status: mappedStatus };
            switch (status.status) {
                case 'sent':
                    updateData.sentAt = timestamp;
                    break;
                case 'delivered':
                    updateData.deliveredAt = timestamp;
                    break;
                case 'read':
                    updateData.readAt = timestamp;
                    break;
                case 'failed':
                    updateData.failedAt = timestamp;
                    updateData.failureReason = status.errors?.[0]?.message || 'Delivery failed';
                    break;
            }
            await database_1.default.campaignContact.updateMany({
                where: { waMessageId: status.id },
                data: updateData,
            });
        }
        catch (error) {
            // silent
        }
    }
    // ============================================
    // CRON MAINTENANCE
    // ============================================
    async expireConversationWindows() {
        try {
            const result = await database_1.default.conversation.updateMany({
                where: {
                    isWindowOpen: true,
                    windowExpiresAt: { lt: new Date() },
                },
                data: { isWindowOpen: false },
            });
            return result.count;
        }
        catch (error) {
            console.error('❌ Error expiring conversation windows:', error);
            throw error;
        }
    }
    async resetDailyMessageLimits() {
        try {
            // Reset all accounts' usage counts to 0
            const result = await database_1.default.whatsAppAccount.updateMany({
                data: {
                    dailyMessagesUsed: 0,
                    lastLimitReset: new Date(),
                },
            });
            return result.count;
        }
        catch (error) {
            console.error('❌ Error resetting daily limits:', error);
            throw error;
        }
    }
    // ============================================
    // HELPERS
    // ============================================
    async updateWebhookLog(id, status, errorMessage) {
        await database_1.default.webhookLog.update({
            where: { id },
            data: { status, processedAt: new Date(), errorMessage },
        });
    }
    mapMessageType(type) {
        const typeMap = {
            text: 'TEXT',
            image: 'IMAGE',
            video: 'VIDEO',
            audio: 'AUDIO',
            document: 'DOCUMENT',
            sticker: 'STICKER',
            location: 'LOCATION',
            contacts: 'CONTACT',
            interactive: 'INTERACTIVE',
            button: 'INTERACTIVE',
        };
        return typeMap[type?.toLowerCase()] || 'TEXT';
    }
    mapStatus(status) {
        const statusMap = {
            sent: client_1.MessageStatus.SENT,
            delivered: client_1.MessageStatus.DELIVERED,
            read: client_1.MessageStatus.READ,
            failed: client_1.MessageStatus.FAILED,
        };
        return statusMap[status] || client_1.MessageStatus.PENDING;
    }
    getMessagePreview(message) {
        if (message.text?.body)
            return message.text.body.substring(0, 100);
        const typeLabels = {
            image: 'Image',
            video: 'Video',
            audio: 'Audio',
            document: 'Document',
            sticker: 'Sticker',
            location: 'Location',
            contacts: 'Contact',
            interactive: 'Interactive',
        };
        return typeLabels[message.type] || message.type;
    }
    extractMessageContent(message) {
        switch (message.type) {
            case 'text':
                return message.text?.body || '';
            case 'image':
                return message.image?.caption || '';
            case 'video':
                return message.video?.caption || '';
            case 'document':
                return message.document?.caption || message.document?.filename || '';
            case 'location':
                return JSON.stringify({
                    latitude: message.location?.latitude,
                    longitude: message.location?.longitude,
                    name: message.location?.name,
                    address: message.location?.address,
                });
            case 'contacts':
                return JSON.stringify(message.contacts);
            case 'interactive':
                if (message.interactive?.button_reply)
                    return message.interactive.button_reply.title;
                if (message.interactive?.list_reply)
                    return message.interactive.list_reply.title;
                return '';
            case 'button':
                return message.button?.text || message.button?.payload || '';
            default:
                return '';
        }
    }
    async getMediaUrl(account, message) {
        let mediaId = null;
        switch (message.type) {
            case 'image':
                mediaId = message.image?.id || null;
                break;
            case 'video':
                mediaId = message.video?.id || null;
                break;
            case 'audio':
                mediaId = message.audio?.id || null;
                break;
            case 'document':
                mediaId = message.document?.id || null;
                break;
            case 'sticker':
                mediaId = message.sticker?.id || null;
                break;
        }
        if (!mediaId)
            return null;
        try {
            const decryptedToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
            if (!decryptedToken)
                return null;
            return await meta_api_1.metaApi.getMediaUrl(mediaId, decryptedToken);
        }
        catch {
            return null;
        }
    }
}
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map