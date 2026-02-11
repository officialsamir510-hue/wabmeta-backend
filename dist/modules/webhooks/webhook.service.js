"use strict";
// src/modules/webhooks/webhook.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = exports.webhookEvents = void 0;
const events_1 = require("events");
const database_1 = __importDefault(require("../../config/database"));
exports.webhookEvents = new events_1.EventEmitter();
class WebhookService {
    verifyWebhook(mode, token, challenge) {
        const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[Webhook] Verification successful');
            return challenge;
        }
        console.log('[Webhook] Verification failed');
        return null;
    }
    async processWebhook(payload) {
        if (payload.object !== 'whatsapp_business_account') {
            console.log('[Webhook] Ignoring non-WhatsApp payload');
            return;
        }
        for (const entry of payload.entry) {
            for (const change of entry.changes) {
                if (change.field === 'messages') {
                    await this.processMessagesChange(change.value);
                }
            }
        }
    }
    async processMessagesChange(value) {
        const { metadata, contacts, messages, statuses } = value;
        const phoneNumberId = metadata.phone_number_id;
        const account = await database_1.default.whatsAppAccount.findUnique({
            where: { phoneNumberId },
            include: { organization: true },
        });
        if (!account) {
            console.log(`[Webhook] No account found for phone number ID: ${phoneNumberId}`);
            return;
        }
        if (messages && messages.length > 0) {
            for (const message of messages) {
                await this.processIncomingMessage(account, message, contacts?.[0]);
            }
        }
        if (statuses && statuses.length > 0) {
            for (const status of statuses) {
                await this.processStatusUpdate(account, status);
            }
        }
    }
    async processIncomingMessage(account, message, contactInfo) {
        try {
            const waId = message.from;
            const phone = '+' + waId;
            // Find or create contact
            let contact = await database_1.default.contact.findUnique({
                where: {
                    organizationId_phone: {
                        organizationId: account.organizationId,
                        phone,
                    },
                },
            });
            if (!contact) {
                contact = await database_1.default.contact.create({
                    data: {
                        organizationId: account.organizationId,
                        phone,
                        firstName: contactInfo?.profile?.name || null, // ✅ Fixed
                        source: 'WHATSAPP',
                    },
                });
            }
            else if (contactInfo?.profile?.name && !contact.firstName) { // ✅ Fixed
                contact = await database_1.default.contact.update({
                    where: { id: contact.id },
                    data: { firstName: contactInfo.profile.name }, // ✅ Fixed
                });
            }
            // Find or create conversation
            let conversation = await database_1.default.conversation.findUnique({
                where: {
                    organizationId_contactId: {
                        organizationId: account.organizationId,
                        contactId: contact.id,
                    },
                },
            });
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organizationId: account.organizationId,
                        phoneNumberId: account.phoneNumberId, // ✅ Fixed
                        contactId: contact.id,
                        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        isWindowOpen: true,
                        unreadCount: 1,
                        lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
                        lastMessagePreview: this.getMessagePreview(message), // ✅ Fixed
                    },
                });
            }
            else {
                await database_1.default.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        isWindowOpen: true,
                        unreadCount: { increment: 1 },
                        lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
                        lastMessagePreview: this.getMessagePreview(message), // ✅ Fixed
                    },
                });
            }
            const existingMessage = await database_1.default.message.findUnique({
                where: { wamId: message.id },
            });
            if (existingMessage) {
                console.log(`[Webhook] Duplicate message ignored: ${message.id}`);
                return;
            }
            const newMessage = await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId: account.id,
                    wamId: message.id,
                    direction: 'INBOUND',
                    type: this.mapMessageType(message.type),
                    content: JSON.stringify(this.extractMessageContent(message)),
                    status: 'DELIVERED',
                    sentAt: new Date(parseInt(message.timestamp) * 1000),
                },
                include: {
                    conversation: {
                        include: {
                            contact: true,
                        },
                    },
                },
            });
            exports.webhookEvents.emit('newMessage', {
                organizationId: account.organizationId,
                accountId: account.id,
                conversationId: conversation.id,
                message: newMessage,
            });
            console.log(`[Webhook] New message saved: ${message.id}`);
        }
        catch (error) {
            console.error('[Webhook] Error processing message:', error);
        }
    }
    async processStatusUpdate(account, status) {
        try {
            const message = await database_1.default.message.findUnique({
                where: { wamId: status.id },
            });
            if (!message) {
                console.log(`[Webhook] Message not found for status update: ${status.id}`);
                return;
            }
            const statusMap = {
                sent: 'SENT',
                delivered: 'DELIVERED',
                read: 'READ',
                failed: 'FAILED',
            };
            const updateData = {
                status: statusMap[status.status] || message.status,
                statusUpdatedAt: new Date(),
            };
            if (status.status === 'sent') {
                updateData.sentAt = new Date(parseInt(status.timestamp) * 1000);
            }
            else if (status.status === 'delivered') {
                updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
            }
            else if (status.status === 'read') {
                updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
            }
            else if (status.status === 'failed' && status.errors?.[0]) {
                updateData.failureReason = status.errors[0].title;
            }
            await database_1.default.message.update({
                where: { id: message.id },
                data: updateData,
            });
            // ✅ Fixed: campaignRecipient → campaignContact
            await database_1.default.campaignContact.updateMany({
                where: { waMessageId: status.id },
                data: {
                    status: status.status === 'read' ? 'READ' :
                        status.status === 'delivered' ? 'DELIVERED' :
                            status.status === 'sent' ? 'SENT' :
                                status.status === 'failed' ? 'FAILED' : 'PENDING',
                    ...(status.status === 'delivered' && { deliveredAt: new Date() }),
                    ...(status.status === 'read' && { readAt: new Date() }),
                    ...(status.status === 'failed' && {
                        failedAt: new Date(),
                        failureReason: status.errors?.[0]?.title,
                    }),
                },
            });
            exports.webhookEvents.emit('messageStatus', {
                organizationId: account.organizationId,
                messageId: message.id,
                wamId: status.id,
                status: status.status,
            });
            console.log(`[Webhook] Status updated: ${status.id} -> ${status.status}`);
        }
        catch (error) {
            console.error('[Webhook] Error processing status:', error);
        }
    }
    // ✅ Fixed: MessageType enum values
    mapMessageType(type) {
        const typeMap = {
            text: 'TEXT',
            image: 'IMAGE',
            video: 'VIDEO',
            audio: 'AUDIO',
            document: 'DOCUMENT',
            sticker: 'STICKER',
            location: 'LOCATION',
            contacts: 'CONTACT', // ✅ Fixed: CONTACTS → CONTACT
            interactive: 'INTERACTIVE',
            button: 'INTERACTIVE',
            reaction: 'TEXT', // ✅ Fixed: REACTION → TEXT
        };
        return typeMap[type] || 'TEXT';
    }
    extractMessageContent(message) {
        switch (message.type) {
            case 'text':
                return { text: message.text?.body };
            case 'image':
                return { mediaId: message.image?.id, caption: message.image?.caption };
            case 'video':
                return { mediaId: message.video?.id, caption: message.video?.caption };
            case 'audio':
                return { mediaId: message.audio?.id };
            case 'document':
                return {
                    mediaId: message.document?.id,
                    filename: message.document?.filename,
                    caption: message.document?.caption,
                };
            case 'sticker':
                return { mediaId: message.sticker?.id };
            case 'location':
                return message.location;
            case 'contacts':
                return { contacts: message.contacts };
            case 'interactive':
                return message.interactive;
            case 'button':
                return { button: message.button };
            default:
                return {};
        }
    }
    getMessagePreview(message) {
        switch (message.type) {
            case 'text':
                return message.text?.body?.substring(0, 100) || '';
            case 'image':
                return '📷 Image';
            case 'video':
                return '🎥 Video';
            case 'audio':
                return '🎵 Audio';
            case 'document':
                return `📄 ${message.document?.filename || 'Document'}`;
            case 'sticker':
                return '🏷️ Sticker';
            case 'location':
                return '📍 Location';
            case 'contacts':
                return '👤 Contact';
            default:
                return 'New message';
        }
    }
}
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map