"use strict";
// src/services/messageQueue.service.ts
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
exports.addToWhatsAppQueue = exports.messageQueueWorker = exports.getQueueStats = exports.addMessage = exports.messageQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const events_1 = require("events");
const config_1 = require("../config");
const whatsapp_api_1 = __importDefault(require("../modules/whatsapp/whatsapp.api"));
const database_1 = __importDefault(require("../config/database"));
// ✅ Check if Redis is configured
const redisUrl = process.env.REDIS_URL || config_1.config.redis?.url;
if (!redisUrl) {
    console.warn('⚠️ Redis not configured. Message queue will NOT work!');
    console.warn('⚠️ Messages will NOT be sent automatically!');
}
// ✅ Create queue with optimized Redis config
const createRedisClient = () => {
    if (!redisUrl)
        return undefined;
    // Bull handles the connection, but we want to ensure TLS and retry settings are correct
    const isSecure = redisUrl.startsWith('rediss://');
    return {
        redis: redisUrl,
        // Optional: you can pass an object if you need more control
        // 但 most of the time passing the URL string to Bull is fine 
        // IF we handle the TLS correctly if it doesn't auto-detect.
    };
};
// Bull actually prefers an options object for the whole thing or a URL
exports.messageQueue = new bull_1.default('whatsapp-messages', redisUrl || 'redis://localhost:6379', {
    redis: {
        // Correct way to handle TLS with some providers
        tls: redisUrl?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    },
    limiter: {
        max: 80, // Meta allows 80 messages/sec
        duration: 1000,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 500, // Keep last 500 failed
    },
});
// ✅ Process messages
exports.messageQueue.process(async (job) => {
    console.log(`📤 Processing message job: ${job.id}`);
    console.log(`📞 Phone: ${job.data.phone}`);
    const { campaignId, campaignContactId, contactId, phone, templateId, whatsappAccountId, organizationId, variables = {}, } = job.data;
    try {
        // Get template
        const template = await database_1.default.template.findUnique({
            where: { id: templateId },
        });
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        // Get WhatsApp account
        const account = await database_1.default.whatsAppAccount.findUnique({
            where: { id: whatsappAccountId },
        });
        if (!account || !account.accessToken) {
            throw new Error(`WhatsApp account not found or no token: ${whatsappAccountId}`);
        }
        console.log(`📧 Sending template: ${template.name} to ${phone}`);
        // ✅ Build template components
        const components = {};
        // Map variables to template parameters
        const templateVars = template.variables;
        if (templateVars && Array.isArray(templateVars) && Object.keys(variables).length > 0) {
            components.body = templateVars.map((varName) => variables[varName] || '');
        }
        // ✅ Decrypt token
        const { decrypt } = await Promise.resolve().then(() => __importStar(require('../utils/encryption')));
        const token = decrypt(account.accessToken);
        // ✅ Send message via WhatsApp API
        const result = await whatsapp_api_1.default.sendTemplateMessage(account.phoneNumberId, phone, template.name, template.language, components, token || undefined);
        console.log(`✅ Message sent: ${result.waMessageId}`);
        // ✅ Update campaign contact
        await database_1.default.campaignContact.update({
            where: { id: campaignContactId },
            data: {
                status: 'SENT',
                waMessageId: result.waMessageId,
                sentAt: new Date(),
            },
        });
        // ✅ Create or Update conversation and message record
        let conversation = await database_1.default.conversation.findFirst({
            where: {
                organizationId,
                contactId: contactId,
            },
        });
        const now = new Date();
        const windowExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (!conversation) {
            // Try finding by phone variants if contactId lookup fails or to be extra safe
            conversation = await database_1.default.conversation.findFirst({
                where: {
                    organizationId,
                    contact: {
                        phone: {
                            in: [phone, `+91${phone}`, `91${phone}`],
                        },
                    },
                },
            });
        }
        if (!conversation) {
            conversation = await database_1.default.conversation.create({
                data: {
                    organizationId,
                    contactId: contactId,
                    lastMessageAt: now,
                    lastMessagePreview: `Template: ${template.name}`,
                    isWindowOpen: true,
                    windowExpiresAt: windowExpiresAt,
                    unreadCount: 0,
                    isRead: true,
                },
            });
            console.log(`✅ New conversation created for outbound: ${conversation.id}`);
        }
        else {
            await database_1.default.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: now,
                    lastMessagePreview: `Template: ${template.name}`,
                    isWindowOpen: true,
                    windowExpiresAt: windowExpiresAt,
                },
            });
        }
        const savedMessage = await database_1.default.message.create({
            data: {
                conversationId: conversation.id,
                whatsappAccountId,
                waMessageId: result.waMessageId,
                wamId: result.waMessageId,
                direction: 'OUTBOUND',
                type: 'TEMPLATE',
                content: JSON.stringify({
                    templateName: template.name,
                    variables,
                }),
                status: 'SENT',
                sentAt: now,
                templateId: template.id,
                metadata: {
                    campaignId,
                },
            },
        });
        // ✅ Clear inbox cache so the new message shows up
        const { inboxService } = await Promise.resolve().then(() => __importStar(require('../modules/inbox/inbox.service')));
        await inboxService.clearCache(organizationId);
        // ✅ Emit socket events for real-time inbox updates
        const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../modules/webhooks/webhook.service')));
        const updatedConversation = await database_1.default.conversation.findUnique({
            where: { id: conversation.id },
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
        if (updatedConversation) {
            webhookEvents.emit('newMessage', {
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
            webhookEvents.emit('conversationUpdated', {
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
        console.log(`✅ Job ${job.id} completed successfully`);
        return { success: true, waMessageId: result.waMessageId };
    }
    catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error.message);
        // Update campaign contact as failed
        if (campaignContactId) {
            await database_1.default.campaignContact.update({
                where: { id: campaignContactId },
                data: {
                    status: 'FAILED',
                    failureReason: error.message,
                    failedAt: new Date(),
                },
            });
        }
        throw error; // Will be retried by Bull
    }
});
// ✅ Event listeners
exports.messageQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
});
exports.messageQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});
exports.messageQueue.on('error', (error) => {
    console.error('❌ Queue error:', error);
});
// ✅ Export functions
const addMessage = async (data) => {
    console.log(`➕ Adding message to queue: ${data.phone}`);
    const job = await exports.messageQueue.add(data, {
        jobId: `${data.campaignId}-${data.phone}-${Date.now()}`,
    });
    console.log(`✅ Job created: ${job.id}`);
    return job;
};
exports.addMessage = addMessage;
const getQueueStats = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        exports.messageQueue.getWaitingCount(),
        exports.messageQueue.getActiveCount(),
        exports.messageQueue.getCompletedCount(),
        exports.messageQueue.getFailedCount(),
        exports.messageQueue.getDelayedCount(),
    ]);
    const total = waiting + active + completed + failed + delayed;
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total,
        // Aligned with campaigns.routes.ts expectations
        pending: waiting,
        processing: active,
        sent: completed
    };
};
exports.getQueueStats = getQueueStats;
/**
 * messageQueueWorker object to maintain compatibility with server.ts and routes
 */
exports.messageQueueWorker = Object.assign(new events_1.EventEmitter(), {
    isRunning: true,
    start: async () => {
        console.log('🚀 Message Queue Worker started');
    },
    stop: async () => {
        await exports.messageQueue.close();
    },
    addToQueue: exports.addMessage,
    getQueueStats: exports.getQueueStats,
    retryFailedMessages: async (campaignId) => {
        const failedJobs = await exports.messageQueue.getFailed();
        let count = 0;
        for (const job of failedJobs) {
            if (!campaignId || job.data.campaignId === campaignId) {
                await job.retry();
                count++;
            }
        }
        return count;
    },
    clearFailedMessages: async () => {
        const failedJobs = await exports.messageQueue.getFailed();
        await Promise.all(failedJobs.map(job => job.remove()));
        return failedJobs.length;
    },
    getHealthStatus: async () => {
        const stats = await (0, exports.getQueueStats)();
        return {
            status: 'RUNNING',
            healthy: true,
            stats,
            timestamp: new Date(),
        };
    },
    whatsappQueue: exports.messageQueue
});
exports.addToWhatsAppQueue = exports.addMessage;
exports.default = exports.messageQueue;
//# sourceMappingURL=messageQueue.service.js.map