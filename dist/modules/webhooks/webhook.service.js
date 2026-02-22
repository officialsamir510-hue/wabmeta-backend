"use strict";
// src/modules/webhooks/webhook.service.ts - COMPLETE FINAL (NO getIO CIRCULAR) + webhookEvents
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = exports.WebhookService = exports.webhookEvents = void 0;
const database_1 = __importDefault(require("../../config/database"));
const contacts_service_1 = require("../contacts/contacts.service");
const events_1 = require("events");
// ✅ Socket.ts will subscribe to this
exports.webhookEvents = new events_1.EventEmitter();
exports.webhookEvents.setMaxListeners(100);
class WebhookService {
    // -----------------------------
    // Helpers
    // -----------------------------
    extractValue(payload) {
        return payload?.entry?.[0]?.changes?.[0]?.value;
    }
    extractProfile(payload) {
        try {
            const value = this.extractValue(payload);
            const msg = value?.messages?.[0];
            if (!msg)
                return null;
            const contact = value?.contacts?.[0];
            const waId = String(msg.from || '');
            // waId format: 9198XXXXXXXX
            let phone10 = waId;
            if (phone10.startsWith('91') && phone10.length === 12)
                phone10 = phone10.substring(2);
            return {
                waId,
                profileName: contact?.profile?.name || 'Unknown',
                phone10,
            };
        }
        catch (e) {
            console.error('extractProfile error:', e);
            return null;
        }
    }
    isIndianNumber(waId) {
        return typeof waId === 'string' && waId.startsWith('91') && waId.length === 12;
    }
    mapMessageType(typeRaw) {
        const t = String(typeRaw || '').toLowerCase();
        const map = {
            text: 'TEXT',
            image: 'IMAGE',
            video: 'VIDEO',
            audio: 'AUDIO',
            document: 'DOCUMENT',
            sticker: 'STICKER',
            location: 'LOCATION',
            contacts: 'CONTACT', // WhatsApp "contacts" => Prisma "CONTACT"
            interactive: 'INTERACTIVE',
            button: 'INTERACTIVE',
            list: 'INTERACTIVE',
            template: 'TEMPLATE',
        };
        return map[t] || 'TEXT';
    }
    buildContentAndMedia(message) {
        const type = String(message?.type || 'text').toLowerCase();
        if (type === 'text')
            return { content: message?.text?.body || '', mediaUrl: null };
        if (type === 'image')
            return { content: message?.image?.caption || '[Image]', mediaUrl: message?.image?.id || null };
        if (type === 'video')
            return { content: message?.video?.caption || '[Video]', mediaUrl: message?.video?.id || null };
        if (type === 'document')
            return { content: message?.document?.filename || '[Document]', mediaUrl: message?.document?.id || null };
        if (type === 'audio')
            return { content: '[Audio]', mediaUrl: message?.audio?.id || null };
        if (type === 'sticker')
            return { content: '[Sticker]', mediaUrl: message?.sticker?.id || null };
        if (type === 'location')
            return { content: '[Location]', mediaUrl: null };
        if (type === 'contacts')
            return { content: '[Contact]', mediaUrl: null };
        return { content: `[${type}]`, mediaUrl: null };
    }
    async findOrCreateContact(organizationId, phone10) {
        // Robust matching
        const variants = [phone10, `+91${phone10}`, `91${phone10}`];
        let contact = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map((p) => ({ phone: p })),
            },
        });
        if (!contact) {
            contact = await database_1.default.contact.create({
                data: {
                    organizationId,
                    phone: phone10,
                    countryCode: '+91',
                    firstName: 'Unknown',
                    status: 'ACTIVE',
                    source: 'WHATSAPP_INBOUND',
                },
            });
        }
        return contact;
    }
    // -----------------------------
    // Main Handler
    // -----------------------------
    async handleWebhook(payload) {
        try {
            console.log('📨 Webhook received');
            const profile = this.extractProfile(payload);
            if (!profile)
                return { status: 'ignored', reason: 'No profile data' };
            if (!this.isIndianNumber(profile.waId)) {
                return { status: 'rejected', reason: 'Only Indian numbers (+91) are allowed' };
            }
            const value = this.extractValue(payload);
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId)
                return { status: 'error', reason: 'No phone_number_id' };
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { phoneNumberId },
            });
            if (!account)
                return { status: 'error', reason: 'Account not found' };
            // Update contact name from webhook
            if (profile.profileName && profile.profileName !== 'Unknown') {
                await contacts_service_1.contactsService.updateContactFromWebhook(profile.phone10, profile.profileName, account.organizationId);
            }
            // Messages
            const messages = value?.messages || [];
            for (const msg of messages) {
                await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId);
            }
            // Statuses
            const statuses = value?.statuses || [];
            for (const st of statuses) {
                await this.processStatusUpdate(st, account.organizationId, account.id);
            }
            return { status: 'processed', profileName: profile.profileName };
        }
        catch (e) {
            console.error('❌ Webhook processing error:', e);
            return { status: 'error', error: e.message };
        }
    }
    // -----------------------------
    // Incoming message processing
    // -----------------------------
    async processIncomingMessage(message, organizationId, whatsappAccountId, phoneNumberId) {
        try {
            const waFrom = String(message?.from || '');
            const waMessageId = String(message?.id || '');
            const typeRaw = String(message?.type || 'text');
            const ts = Number(message?.timestamp || Date.now() / 1000);
            const messageTime = new Date(ts * 1000);
            let phone10 = waFrom;
            if (phone10.startsWith('91') && phone10.length === 12)
                phone10 = phone10.substring(2);
            const contact = await this.findOrCreateContact(organizationId, phone10);
            // Find or create conversation
            let conversation = await database_1.default.conversation.findFirst({
                where: { organizationId, contactId: contact.id },
            });
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organizationId,
                        contactId: contact.id,
                        phoneNumberId,
                        isWindowOpen: true,
                        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        unreadCount: 0,
                        isRead: true,
                        lastMessageAt: messageTime,
                    },
                });
            }
            const { content, mediaUrl } = this.buildContentAndMedia(message);
            const msgType = this.mapMessageType(typeRaw);
            // Save message
            const savedMessage = await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId,
                    waMessageId,
                    wamId: waMessageId,
                    direction: 'INBOUND',
                    type: msgType,
                    content,
                    mediaUrl,
                    status: 'DELIVERED',
                    sentAt: messageTime,
                    deliveredAt: messageTime,
                    createdAt: messageTime,
                },
            });
            // Update conversation
            const updatedConversation = await database_1.default.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: messageTime,
                    lastMessagePreview: (content || `[${typeRaw}]`).substring(0, 100),
                    lastCustomerMessageAt: messageTime,
                    unreadCount: { increment: 1 },
                    isRead: false,
                    isWindowOpen: true,
                    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
                include: {
                    contact: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                            whatsappProfileName: true,
                        },
                    },
                },
            });
            // Update contact stats
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: messageTime,
                    messageCount: { increment: 1 },
                },
            });
            console.log(`✅ Incoming message saved: ${savedMessage.id} wa:${waMessageId}`);
            // ✅ Emit events (socket.ts will broadcast)
            exports.webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                message: {
                    id: savedMessage.id,
                    conversationId: updatedConversation.id,
                    waMessageId: savedMessage.waMessageId,
                    direction: savedMessage.direction,
                    type: savedMessage.type,
                    content: savedMessage.content,
                    mediaUrl: savedMessage.mediaUrl,
                    status: savedMessage.status,
                    createdAt: savedMessage.createdAt,
                },
            });
            exports.webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: {
                    id: updatedConversation.id,
                    lastMessageAt: updatedConversation.lastMessageAt,
                    lastMessagePreview: updatedConversation.lastMessagePreview,
                    unreadCount: updatedConversation.unreadCount,
                    isRead: updatedConversation.isRead,
                    isArchived: updatedConversation.isArchived,
                    contact: updatedConversation.contact,
                },
            });
        }
        catch (e) {
            console.error('processIncomingMessage error:', e);
        }
    }
    // -----------------------------
    // Status update processing
    // -----------------------------
    async processStatusUpdate(statusObj, organizationId, whatsappAccountId) {
        try {
            const waMessageId = String(statusObj?.id || '');
            const st = String(statusObj?.status || '').toLowerCase();
            const ts = Number(statusObj?.timestamp || Date.now() / 1000);
            const statusTime = new Date(ts * 1000);
            const message = await database_1.default.message.findFirst({
                where: { waMessageId, whatsappAccountId },
            });
            if (!message)
                return;
            let newStatus = 'SENT';
            if (st === 'sent')
                newStatus = 'SENT';
            if (st === 'delivered')
                newStatus = 'DELIVERED';
            if (st === 'read')
                newStatus = 'READ';
            if (st === 'failed')
                newStatus = 'FAILED';
            await database_1.default.message.update({
                where: { id: message.id },
                data: {
                    status: newStatus,
                    statusUpdatedAt: statusTime,
                    ...(st === 'sent' ? { sentAt: statusTime } : {}),
                    ...(st === 'delivered' ? { deliveredAt: statusTime } : {}),
                    ...(st === 'read' ? { readAt: statusTime } : {}),
                    ...(st === 'failed'
                        ? {
                            failedAt: statusTime,
                            failureReason: statusObj?.errors?.[0]?.message || 'Unknown error',
                        }
                        : {}),
                },
            });
            exports.webhookEvents.emit('messageStatus', {
                organizationId,
                conversationId: message.conversationId,
                messageId: message.id,
                waMessageId,
                status: newStatus,
                timestamp: statusTime.toISOString(),
            });
            console.log(`✅ Status updated wa:${waMessageId} -> ${newStatus}`);
        }
        catch (e) {
            console.error('processStatusUpdate error:', e);
        }
    }
    // -----------------------------
    // Verify webhook
    // -----------------------------
    verifyWebhook(mode, token, challenge) {
        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'wabmeta_webhook_verify_2024';
        if (mode === 'subscribe' && token === VERIFY_TOKEN)
            return challenge;
        return null;
    }
    // -----------------------------
    // Log webhook
    // -----------------------------
    async logWebhook(payload, status, error) {
        try {
            const value = this.extractValue(payload);
            const phoneNumberId = value?.metadata?.phone_number_id;
            let organizationId = null;
            if (phoneNumberId) {
                const account = await database_1.default.whatsAppAccount.findFirst({
                    where: { phoneNumberId },
                    select: { organizationId: true },
                });
                organizationId = account?.organizationId || null;
            }
            // webhookLog enum: PENDING/PROCESSING/SUCCESS/FAILED
            const mapped = status === 'processed' ? 'SUCCESS' :
                status === 'error' ? 'FAILED' :
                    status === 'rejected' ? 'FAILED' :
                        status === 'ignored' ? 'SUCCESS' :
                            'SUCCESS';
            await database_1.default.webhookLog.create({
                data: {
                    organizationId,
                    source: 'whatsapp',
                    eventType: payload?.entry?.[0]?.changes?.[0]?.field || 'unknown',
                    payload,
                    status: mapped,
                    processedAt: new Date(),
                    errorMessage: error || null,
                },
            });
        }
        catch (e) {
            console.error('logWebhook error:', e);
        }
    }
}
exports.WebhookService = WebhookService;
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map