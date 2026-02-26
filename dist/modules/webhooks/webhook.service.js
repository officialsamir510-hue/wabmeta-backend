"use strict";
// src/modules/webhooks/webhook.service.ts - COMPLETE FIXED VERSION
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
            contacts: 'CONTACT',
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
            const value = this.extractValue(payload);
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) {
                return { status: 'error', reason: 'No phone_number_id' };
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { phoneNumberId },
            });
            if (!account) {
                return { status: 'error', reason: 'Account not found for phoneNumberId: ' + phoneNumberId };
            }
            // Process incoming messages
            const messages = value?.messages || [];
            for (const msg of messages) {
                const profile = this.extractProfile(payload);
                if (profile) {
                    // Update contact name from webhook
                    if (profile.profileName && profile.profileName !== 'Unknown') {
                        await contacts_service_1.contactsService.updateContactFromWebhook(profile.phone10, profile.profileName, account.organizationId);
                    }
                    await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId);
                }
            }
            // ✅ Process status updates (CRITICAL FOR TICK MARKS)
            const statuses = value?.statuses || [];
            for (const st of statuses) {
                await this.processStatusUpdate(st, account.organizationId, account.id);
            }
            return { status: 'processed' };
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
            let conversation = await database_1.default.conversation.findFirst({
                where: { organizationId, contactId: contact.id },
            });
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organizationId,
                        contactId: contact.id,
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
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: messageTime,
                    messageCount: { increment: 1 },
                },
            });
            console.log(`✅ Incoming message saved: ${savedMessage.id} wa:${waMessageId}`);
            // ✅ Clear inbox cache
            const { inboxService } = await Promise.resolve().then(() => __importStar(require('../inbox/inbox.service')));
            await inboxService.clearCache(organizationId);
            // ✅ Emit events
            exports.webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                message: {
                    id: savedMessage.id,
                    conversationId: updatedConversation.id,
                    waMessageId: savedMessage.waMessageId,
                    wamId: savedMessage.wamId,
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
                    isWindowOpen: updatedConversation.isWindowOpen,
                    windowExpiresAt: updatedConversation.windowExpiresAt,
                    contact: updatedConversation.contact,
                },
            });
        }
        catch (e) {
            console.error('processIncomingMessage error:', e);
        }
    }
    // -----------------------------
    // ✅ Status update processing - FIXED FOR TICK MARKS
    // -----------------------------
    async processStatusUpdate(statusObj, organizationId, whatsappAccountId) {
        try {
            const waMessageId = String(statusObj?.id || '');
            const st = String(statusObj?.status || '').toLowerCase();
            const ts = Number(statusObj?.timestamp || Date.now() / 1000);
            const statusTime = new Date(ts * 1000);
            if (!waMessageId) {
                console.warn('⚠️ No waMessageId in status update');
                return;
            }
            console.log(`📬 Processing status update: ${waMessageId} -> ${st}`);
            // ✅ Find message by waMessageId OR wamId
            let message = await database_1.default.message.findFirst({
                where: {
                    OR: [
                        { waMessageId },
                        { wamId: waMessageId },
                    ],
                },
                include: {
                    conversation: {
                        select: {
                            id: true,
                            contactId: true,
                            organizationId: true,
                        },
                    },
                },
            });
            // ✅ Race Condition Fix: If message not found, wait 1s and retry once
            // (Meta sometimes sends status updates faster than we can save the message)
            if (!message) {
                console.log(`⏳ Message not found yet, retrying in 1s for waMessageId: ${waMessageId}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                message = await database_1.default.message.findFirst({
                    where: {
                        OR: [
                            { waMessageId },
                            { wamId: waMessageId },
                        ],
                    },
                    include: {
                        conversation: {
                            select: {
                                id: true,
                                contactId: true,
                                organizationId: true,
                            },
                        },
                    },
                });
            }
            if (!message) {
                console.log(`⚠️ Message still not found for waMessageId: ${waMessageId}`);
                // Optionally: We could "stub" the message here if we had recipient_id
                return;
            }
            // Map status
            let newStatus = 'SENT';
            if (st === 'sent')
                newStatus = 'SENT';
            if (st === 'delivered')
                newStatus = 'DELIVERED';
            if (st === 'read')
                newStatus = 'READ';
            if (st === 'failed')
                newStatus = 'FAILED';
            // ✅ Update message
            const updatedMessage = await database_1.default.message.update({
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
            console.log(`✅ Message status updated: ${message.id} -> ${newStatus}`);
            // Retrieve metadata for tempId/clientMsgId
            const metadata = message.metadata || {};
            // ✅ CRITICAL: Emit socket event for real-time update
            exports.webhookEvents.emit('messageStatus', {
                organizationId: message.conversation?.organizationId || organizationId,
                conversationId: message.conversationId,
                messageId: message.id,
                waMessageId: message.waMessageId,
                wamId: message.wamId,
                status: newStatus,
                timestamp: statusTime.toISOString(),
                tempId: metadata.tempId,
                clientMsgId: metadata.clientMsgId
            });
            // ✅ Update CampaignContact if this is a campaign message
            await this.updateCampaignContactStatus(waMessageId, newStatus, statusTime);
        }
        catch (e) {
            console.error('processStatusUpdate error:', e);
        }
    }
    // ✅ Campaign contact status sync
    async updateCampaignContactStatus(waMessageId, newStatus, statusTime) {
        try {
            const campaignContact = await database_1.default.campaignContact.findFirst({
                where: { waMessageId },
                select: {
                    id: true,
                    campaignId: true,
                    contactId: true,
                    status: true,
                },
            });
            if (!campaignContact)
                return;
            console.log(`📊 Found campaign contact: ${campaignContact.id}`);
            const currentStatus = campaignContact.status;
            const statusPriority = {
                'PENDING': 0,
                'SENT': 1,
                'DELIVERED': 2,
                'READ': 3,
                'FAILED': -1,
            };
            const currentPriority = statusPriority[currentStatus] ?? 0;
            const newPriority = statusPriority[newStatus] ?? 0;
            if (newPriority <= currentPriority && newStatus !== 'FAILED') {
                return;
            }
            await database_1.default.campaignContact.update({
                where: { id: campaignContact.id },
                data: {
                    status: newStatus,
                    ...(newStatus === 'DELIVERED' ? { deliveredAt: statusTime } : {}),
                    ...(newStatus === 'READ' ? { readAt: statusTime } : {}),
                    ...(newStatus === 'FAILED' ? { failedAt: statusTime, failureReason: 'Delivery failed' } : {}),
                },
            });
            console.log(`✅ Campaign contact updated: ${campaignContact.id} -> ${newStatus}`);
            const campaign = await database_1.default.campaign.findUnique({
                where: { id: campaignContact.campaignId },
                select: {
                    id: true,
                    organizationId: true,
                    deliveredCount: true,
                    readCount: true,
                    failedCount: true,
                    sentCount: true,
                    totalContacts: true,
                },
            });
            if (!campaign)
                return;
            const updateData = {};
            if (newStatus === 'DELIVERED' && currentStatus !== 'DELIVERED' && currentStatus !== 'READ') {
                updateData.deliveredCount = { increment: 1 };
            }
            if (newStatus === 'READ' && currentStatus !== 'READ') {
                updateData.readCount = { increment: 1 };
                if (currentStatus === 'SENT') {
                    updateData.deliveredCount = { increment: 1 };
                }
            }
            if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
                updateData.failedCount = { increment: 1 };
            }
            if (Object.keys(updateData).length > 0) {
                await database_1.default.campaign.update({
                    where: { id: campaign.id },
                    data: updateData,
                });
                console.log(`✅ Campaign ${campaign.id} stats updated:`, updateData);
            }
        }
        catch (e) {
            console.error('updateCampaignContactStatus error:', e);
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
    // Optional methods
    async expireConversationWindows() {
        try {
            const now = new Date();
            await database_1.default.conversation.updateMany({
                where: {
                    isWindowOpen: true,
                    windowExpiresAt: { lt: now },
                },
                data: {
                    isWindowOpen: false,
                },
            });
        }
        catch (e) {
            console.error('expireConversationWindows error:', e);
        }
    }
    async resetDailyMessageLimits() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            await database_1.default.whatsAppAccount.updateMany({
                where: {
                    lastLimitReset: { lt: yesterday },
                },
                data: {
                    dailyMessagesUsed: 0,
                    lastLimitReset: new Date(),
                },
            });
        }
        catch (e) {
            console.error('resetDailyMessageLimits error:', e);
        }
    }
}
exports.WebhookService = WebhookService;
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map