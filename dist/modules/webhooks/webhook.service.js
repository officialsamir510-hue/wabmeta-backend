"use strict";
// 📁 src/modules/webhooks/webhook.service.ts - COMPLETE WEBHOOK SERVICE
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = exports.webhookEvents = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("../../config");
const encryption_1 = require("../../utils/encryption");
const meta_api_1 = require("../meta/meta.api");
const events_1 = require("events");
exports.webhookEvents = new events_1.EventEmitter();
exports.webhookEvents.setMaxListeners(20);
const prisma = new client_1.PrismaClient();
// ============================================
// WEBHOOK SERVICE CLASS
// ============================================
class WebhookService {
    // ============================================
    // VERIFY WEBHOOK (GET request from Meta)
    // ============================================
    verifyWebhook(mode, token, challenge) {
        const verifyToken = config_1.config.meta.webhookVerifyToken;
        console.log('🔐 Webhook Verification Request:');
        console.log('   Mode:', mode);
        console.log('   Token matches:', token === verifyToken);
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('✅ Webhook verified successfully');
            return challenge;
        }
        console.error('❌ Webhook verification failed');
        return null;
    }
    // ============================================
    // PROCESS WEBHOOK (POST request from Meta)
    // ============================================
    async processWebhook(payload, signature) {
        const startTime = Date.now();
        console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
        console.log('   Object:', payload?.object);
        console.log('   Entries:', payload?.entry?.length || 0);
        // Log webhook
        const webhookLog = await prisma.webhookLog.create({
            data: {
                source: 'META',
                eventType: payload?.object || 'unknown',
                payload: payload,
                status: client_1.WebhookStatus.PROCESSING,
            },
        });
        try {
            // Verify signature in production
            if (config_1.config.app.isProduction && signature) {
                const isValid = (0, encryption_1.verifyWebhookSignature)(JSON.stringify(payload), signature, config_1.config.meta.appSecret);
                if (!isValid) {
                    console.error('❌ Invalid webhook signature');
                    await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.FAILED, 'Invalid signature');
                    return { success: false, processed: 0 };
                }
            }
            // Only process WhatsApp Business Account webhooks
            if (payload?.object !== 'whatsapp_business_account') {
                console.log('⚠️ Ignoring non-WhatsApp webhook');
                await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.SUCCESS);
                return { success: true, processed: 0 };
            }
            let processedCount = 0;
            // Process each entry
            for (const entry of payload.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === 'messages') {
                        const value = change.value;
                        const phoneNumberId = value.metadata?.phone_number_id;
                        // Find WhatsApp account
                        const account = await prisma.whatsAppAccount.findFirst({
                            where: { phoneNumberId },
                        });
                        if (!account) {
                            console.warn(`⚠️ No account found for phone: ${phoneNumberId}`);
                            continue;
                        }
                        // Update webhook log with organization
                        await prisma.webhookLog.update({
                            where: { id: webhookLog.id },
                            data: { organizationId: account.organizationId },
                        });
                        // Process incoming messages
                        if (value.messages) {
                            for (const message of value.messages) {
                                await this.processIncomingMessage(account, message, value.contacts);
                                processedCount++;
                            }
                        }
                        // Process message statuses
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                await this.processMessageStatus(account, status);
                                processedCount++;
                            }
                        }
                        // Process errors
                        if (value.errors) {
                            for (const error of value.errors) {
                                console.error('📛 Webhook Error:', error);
                            }
                        }
                    }
                }
            }
            const duration = Date.now() - startTime;
            await prisma.webhookLog.update({
                where: { id: webhookLog.id },
                data: {
                    status: client_1.WebhookStatus.SUCCESS,
                    processedAt: new Date(),
                    responseTime: duration,
                },
            });
            console.log(`✅ Webhook processed: ${processedCount} items in ${duration}ms`);
            console.log('📨 ========== WEBHOOK END ==========\n');
            return { success: true, processed: processedCount };
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error);
            await this.updateWebhookLog(webhookLog.id, client_1.WebhookStatus.FAILED, error.message);
            return { success: false, processed: 0 };
        }
    }
    // ============================================
    // PROCESS INCOMING MESSAGE
    // ============================================
    async processIncomingMessage(account, message, contacts) {
        try {
            console.log(`📥 Processing message from: ${message.from}`);
            const phoneNumber = message.from;
            const contactInfo = contacts?.find((c) => c.wa_id === phoneNumber);
            const contactName = contactInfo?.profile?.name;
            // Find or create contact
            let contact = await prisma.contact.findFirst({
                where: {
                    organizationId: account.organizationId,
                    phone: phoneNumber,
                },
            });
            if (!contact) {
                contact = await prisma.contact.create({
                    data: {
                        organizationId: account.organizationId,
                        phone: phoneNumber,
                        firstName: contactName || phoneNumber,
                        source: 'WHATSAPP',
                        status: 'ACTIVE',
                    },
                });
                console.log(`✅ New contact created: ${contact.id}`);
            }
            else if (contactName && !contact.firstName) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { firstName: contactName },
                });
            }
            // Find or create conversation
            let conversation = await prisma.conversation.findFirst({
                where: {
                    organizationId: account.organizationId,
                    contactId: contact.id,
                },
            });
            const now = new Date();
            const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            if (!conversation) {
                conversation = await prisma.conversation.create({
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
                console.log(`✅ New conversation created: ${conversation.id}`);
            }
            else {
                await prisma.conversation.update({
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
            // Check for duplicate message
            const existingMessage = await prisma.message.findFirst({
                where: { waMessageId: message.id },
            });
            if (existingMessage) {
                console.log(`⚠️ Duplicate message ignored: ${message.id}`);
                return;
            }
            // Create message
            const messageData = await prisma.message.create({
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
                    metadata: {
                        originalType: message.type,
                        context: message.context || null,
                    },
                },
            });
            console.log(`✅ Message saved: ${messageData.id}`);
            // Emit event for real-time updates
            exports.webhookEvents.emit('newMessage', {
                ...messageData,
                organizationId: account.organizationId,
            });
            // Update contact stats
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: now,
                    messageCount: { increment: 1 },
                },
            });
        }
        catch (error) {
            console.error('❌ Error processing incoming message:', error);
        }
    }
    // ============================================
    // PROCESS MESSAGE STATUS UPDATE
    // ============================================
    async processMessageStatus(account, status) {
        try {
            console.log(`📊 Status update: ${status.id} -> ${status.status}`);
            const message = await prisma.message.findFirst({
                where: {
                    OR: [{ waMessageId: status.id }, { wamId: status.id }],
                },
            });
            if (!message) {
                console.warn(`⚠️ Message not found for status: ${status.id}`);
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
                    updateData.failureReason =
                        status.errors?.[0]?.message || status.errors?.[0]?.title || 'Unknown error';
                    break;
            }
            await prisma.message.update({
                where: { id: message.id },
                data: updateData,
            });
            console.log(`✅ Status updated: ${message.id} -> ${status.status}`);
            // Update conversation window if needed
            if (status.conversation?.expiration_timestamp) {
                const conversation = await prisma.conversation.findUnique({
                    where: { id: message.conversationId },
                });
                if (conversation) {
                    await prisma.conversation.update({
                        where: { id: conversation.id },
                        data: {
                            windowExpiresAt: new Date(parseInt(status.conversation.expiration_timestamp) * 1000),
                            isWindowOpen: true,
                        },
                    });
                }
            }
            // Update campaign contact if applicable
            if (message.templateId) {
                await prisma.campaignContact.updateMany({
                    where: { waMessageId: status.id },
                    data: {
                        status: this.mapStatus(status.status),
                        ...(status.status === 'sent' && { sentAt: timestamp }),
                        ...(status.status === 'delivered' && { deliveredAt: timestamp }),
                        ...(status.status === 'read' && { readAt: timestamp }),
                        ...(status.status === 'failed' && {
                            failedAt: timestamp,
                            failureReason: status.errors?.[0]?.message || 'Failed',
                        }),
                    },
                });
            }
            // Emit status update for real-time broadcasting
            exports.webhookEvents.emit('messageStatus', {
                messageId: message.id,
                waMessageId: status.id,
                status: this.mapStatus(status.status),
                organizationId: account.organizationId,
                conversationId: message.conversationId,
            });
        }
        catch (error) {
            console.error('❌ Error processing status update:', error);
        }
    }
    // ============================================
    // HELPER METHODS
    // ============================================
    async updateWebhookLog(id, status, errorMessage) {
        await prisma.webhookLog.update({
            where: { id },
            data: {
                status,
                processedAt: new Date(),
                errorMessage,
            },
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
        if (message.text?.body) {
            return message.text.body.substring(0, 100);
        }
        const typeLabels = {
            image: '📷 Image',
            video: '🎥 Video',
            audio: '🎵 Audio',
            document: '📄 Document',
            sticker: '🏷️ Sticker',
            location: '📍 Location',
            contacts: '👤 Contact',
            interactive: '🔘 Interactive',
        };
        return typeLabels[message.type] || `📨 ${message.type}`;
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
                if (message.interactive?.button_reply) {
                    return message.interactive.button_reply.title;
                }
                if (message.interactive?.list_reply) {
                    return message.interactive.list_reply.title;
                }
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
            if (!decryptedToken) {
                console.error('❌ Failed to decrypt token for media retrieval');
                return null;
            }
            const mediaUrl = await meta_api_1.metaApi.getMediaUrl(mediaId, decryptedToken);
            return mediaUrl;
        }
        catch (error) {
            console.error('❌ Error fetching media URL:', error);
            return null;
        }
    }
    // ============================================
    // EXPIRE CONVERSATION WINDOWS
    // ============================================
    async expireConversationWindows() {
        try {
            const result = await prisma.conversation.updateMany({
                where: {
                    isWindowOpen: true,
                    windowExpiresAt: { lt: new Date() },
                },
                data: {
                    isWindowOpen: false,
                },
            });
            if (result.count > 0) {
                console.log(`⏰ Expired ${result.count} conversation windows`);
            }
            return result.count;
        }
        catch (error) {
            console.error('❌ Error expiring windows:', error);
            return 0;
        }
    }
    // ============================================
    // RESET DAILY MESSAGE LIMITS
    // ============================================
    async resetDailyMessageLimits() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const result = await prisma.whatsAppAccount.updateMany({
                where: {
                    lastLimitReset: { lt: yesterday },
                },
                data: {
                    dailyMessagesUsed: 0,
                    lastLimitReset: new Date(),
                },
            });
            if (result.count > 0) {
                console.log(`🔄 Reset daily limits for ${result.count} accounts`);
            }
            return result.count;
        }
        catch (error) {
            console.error('❌ Error resetting limits:', error);
            return 0;
        }
    }
}
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map