"use strict";
// 📁 src/services/messageQueue.service.ts - COMPLETE MESSAGE QUEUE WORKER
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageQueueWorker = void 0;
const client_1 = require("@prisma/client");
const meta_service_1 = require("../modules/meta/meta.service");
const meta_api_1 = require("../modules/meta/meta.api");
// Custom QueueStatus enum (not in Prisma schema yet)
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["PENDING"] = "PENDING";
    QueueStatus["PROCESSING"] = "PROCESSING";
    QueueStatus["SENT"] = "SENT";
    QueueStatus["FAILED"] = "FAILED";
    QueueStatus["CANCELLED"] = "CANCELLED";
})(QueueStatus || (QueueStatus = {}));
const events_1 = require("events");
const database_1 = __importDefault(require("../config/database"));
// ============================================
// MESSAGE QUEUE WORKER CLASS
// ============================================
class MessageQueueWorker extends events_1.EventEmitter {
    config;
    isRunning = false;
    workers = new Set();
    stopRequested = false;
    constructor(config) {
        super();
        this.config = {
            batchSize: config?.batchSize || 10,
            pollInterval: config?.pollInterval || 2000, // 2 seconds
            maxRetries: config?.maxRetries || 3,
            retryDelays: config?.retryDelays || [
                5 * 60 * 1000, // 5 minutes
                15 * 60 * 1000, // 15 minutes
                60 * 60 * 1000, // 1 hour
            ],
            concurrentWorkers: config?.concurrentWorkers || 3,
        };
        console.log('📨 Message Queue Worker initialized:', this.config);
    }
    // ============================================
    // START WORKER
    // ============================================
    async start() {
        if (this.isRunning) {
            console.warn('⚠️ Worker already running');
            return;
        }
        this.isRunning = true;
        this.stopRequested = false;
        console.log('🚀 Starting Message Queue Worker...');
        console.log(`   Workers: ${this.config.concurrentWorkers}`);
        console.log(`   Batch Size: ${this.config.batchSize}`);
        console.log(`   Poll Interval: ${this.config.pollInterval}ms`);
        for (let i = 0; i < this.config.concurrentWorkers; i++) {
            const workerPromise = this.workerLoop(i + 1);
            this.workers.add(workerPromise);
            workerPromise.finally(() => {
                this.workers.delete(workerPromise);
            });
        }
        this.emit('started');
        console.log('✅ Message Queue Worker started');
    }
    // ============================================
    // STOP WORKER
    // ============================================
    async stop() {
        if (!this.isRunning) {
            console.warn('⚠️ Worker not running');
            return;
        }
        console.log('🛑 Stopping Message Queue Worker...');
        this.stopRequested = true;
        this.isRunning = false;
        await Promise.all(Array.from(this.workers));
        this.emit('stopped');
        console.log('✅ Message Queue Worker stopped');
    }
    // ============================================
    // WORKER LOOP
    // ============================================
    async workerLoop(workerId) {
        console.log(`👷 Worker #${workerId} started`);
        while (this.isRunning && !this.stopRequested) {
            try {
                await this.processNextBatch(workerId);
            }
            catch (error) {
                console.error(`❌ Worker #${workerId} error:`, error.message);
                this.emit('error', { workerId, error });
            }
            await this.sleep(this.config.pollInterval);
        }
        console.log(`👷 Worker #${workerId} stopped`);
    }
    // ============================================
    // PROCESS NEXT BATCH
    // ============================================
    async processNextBatch(workerId) {
        const startTime = Date.now();
        const messages = await database_1.default.messageQueue.findMany({
            where: {
                OR: [
                    { status: QueueStatus.PENDING },
                    {
                        status: QueueStatus.FAILED,
                        retryCount: { lt: this.config.maxRetries },
                        nextRetryAt: { lte: new Date() },
                    },
                ],
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' },
            ],
            take: this.config.batchSize,
            include: {
                contact: true,
                whatsappAccount: true,
                template: true,
                campaign: true,
            },
        });
        if (messages.length === 0) {
            return;
        }
        console.log(`📨 Worker #${workerId}: Processing ${messages.length} messages`);
        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        for (const message of messages) {
            if (this.stopRequested) {
                console.log(`⚠️ Worker #${workerId}: Stop requested, breaking loop`);
                break;
            }
            try {
                await database_1.default.messageQueue.update({
                    where: { id: message.id },
                    data: { status: QueueStatus.PROCESSING },
                });
                const result = await this.processMessage(message);
                if (result.success) {
                    succeeded++;
                    this.emit('message:sent', {
                        queueId: message.id,
                        contactId: message.contactId,
                        waMessageId: result.waMessageId,
                    });
                }
                else {
                    failed++;
                    this.emit('message:failed', {
                        queueId: message.id,
                        contactId: message.contactId,
                        error: result.error,
                    });
                }
                processed++;
            }
            catch (error) {
                console.error(`❌ Error processing queue item ${message.id}:`, error);
                failed++;
                await this.handleFailure(message.id, error.message, message.retryCount);
            }
        }
        const duration = Date.now() - startTime;
        console.log(`✅ Worker #${workerId}: Batch complete in ${duration}ms`);
        console.log(`   Processed: ${processed}, Success: ${succeeded}, Failed: ${failed}`);
        this.emit('batch:complete', {
            workerId,
            processed,
            succeeded,
            failed,
            duration,
        });
    }
    // ============================================
    // PROCESS SINGLE MESSAGE
    // ============================================
    async processMessage(queueItem) {
        try {
            const { contact, whatsappAccount, template, templateParams } = queueItem;
            console.log(`📤 Sending message to ${contact.phone} via account ${whatsappAccount.id}`);
            const canSend = await this.checkRateLimits(whatsappAccount);
            if (!canSend) {
                console.warn(`⚠️ Rate limit reached for account ${whatsappAccount.id}`);
                await database_1.default.messageQueue.update({
                    where: { id: queueItem.id },
                    data: {
                        status: QueueStatus.PENDING,
                        nextRetryAt: new Date(Date.now() + 10 * 60 * 1000),
                    },
                });
                return {
                    success: false,
                    error: 'Rate limit reached',
                    errorCode: 'RATE_LIMIT',
                };
            }
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(whatsappAccount.id);
            if (!accountWithToken) {
                throw new Error('Failed to get account access token. Please reconnect WhatsApp.');
            }
            const { accessToken } = accountWithToken;
            // Construct template message
            const templateMessage = {
                type: 'template',
                template: {
                    name: template.name,
                    language: {
                        code: template.language,
                    },
                    components: this.parseTemplateParams(templateParams) || [],
                },
            };
            const result = await meta_api_1.metaApi.sendMessage(whatsappAccount.phoneNumberId, accessToken, contact.phone, templateMessage);
            const waMessageId = result.messageId;
            console.log(`✅ Message sent: ${waMessageId}`);
            await database_1.default.messageQueue.update({
                where: { id: queueItem.id },
                data: {
                    status: QueueStatus.SENT,
                    waMessageId: waMessageId,
                    sentAt: new Date(),
                },
            });
            await database_1.default.whatsAppAccount.update({
                where: { id: whatsappAccount.id },
                data: {
                    dailyMessagesUsed: { increment: 1 },
                },
            });
            if (queueItem.campaignId) {
                await database_1.default.campaignContact.updateMany({
                    where: {
                        campaignId: queueItem.campaignId,
                        contactId: contact.id,
                    },
                    data: {
                        status: client_1.MessageStatus.SENT,
                        waMessageId: waMessageId,
                        sentAt: new Date(),
                    },
                });
            }
            await this.createConversationMessage(queueItem, waMessageId);
            return {
                success: true,
                waMessageId: waMessageId,
            };
        }
        catch (error) {
            console.error(`❌ Failed to send message:`, error);
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = error.message || 'Unknown error';
            if (error.response?.data?.error) {
                const metaError = error.response.data.error;
                errorCode = metaError.code?.toString() || 'META_ERROR';
                errorMessage = metaError.message || metaError.error_user_msg || errorMessage;
                if (errorCode === '131047' || errorCode === '131026') {
                    errorCode = 'WINDOW_EXPIRED';
                }
                else if (errorCode === '133016') {
                    errorCode = 'RATE_LIMIT';
                }
                else if (errorCode === '131031') {
                    errorCode = 'INVALID_PARAMS';
                }
                else if (errorCode === '131021') {
                    errorCode = 'INVALID_RECIPIENT';
                }
            }
            await this.handleFailure(queueItem.id, errorMessage, queueItem.retryCount, errorCode);
            if (queueItem.campaignId) {
                await database_1.default.campaignContact.updateMany({
                    where: {
                        campaignId: queueItem.campaignId,
                        contactId: queueItem.contactId,
                    },
                    data: {
                        status: client_1.MessageStatus.FAILED,
                        failedAt: new Date(),
                        failureReason: errorMessage,
                    },
                });
            }
            return {
                success: false,
                error: errorMessage,
                errorCode,
            };
        }
    }
    // ============================================
    // CHECK RATE LIMITS
    // ============================================
    async checkRateLimits(account) {
        if (account.dailyMessagesUsed >= account.dailyMessageLimit) {
            console.warn(`⚠️ Daily limit reached: ${account.dailyMessagesUsed}/${account.dailyMessageLimit}`);
            return false;
        }
        const now = new Date();
        const lastReset = new Date(account.lastLimitReset);
        const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReset >= 24) {
            await database_1.default.whatsAppAccount.update({
                where: { id: account.id },
                data: {
                    dailyMessagesUsed: 0,
                    lastLimitReset: now,
                },
            });
            return true;
        }
        const tierLimits = {
            TIER_50: 50,
            TIER_250: 250,
            TIER_1K: 1000,
            TIER_10K: 10000,
            TIER_100K: 100000,
            TIER_UNLIMITED: 1000000,
        };
        const tierLimit = tierLimits[account.messagingLimit || 'TIER_1K'];
        if (account.dailyMessagesUsed >= tierLimit) {
            console.warn(`⚠️ Meta tier limit reached: ${account.messagingLimit}`);
            return false;
        }
        return true;
    }
    // ============================================
    // HANDLE FAILURE
    // ============================================
    async handleFailure(queueId, errorMessage, currentRetryCount, errorCode) {
        const newRetryCount = currentRetryCount + 1;
        if (newRetryCount <= this.config.maxRetries) {
            const retryDelay = this.config.retryDelays[newRetryCount - 1] || 60 * 60 * 1000;
            const nextRetryAt = new Date(Date.now() + retryDelay);
            console.log(`🔄 Scheduling retry #${newRetryCount} at ${nextRetryAt.toISOString()}`);
            await database_1.default.messageQueue.update({
                where: { id: queueId },
                data: {
                    status: QueueStatus.FAILED,
                    retryCount: newRetryCount,
                    nextRetryAt,
                    errorMessage,
                    errorCode,
                },
            });
        }
        else {
            console.error(`❌ Max retries reached for queue item ${queueId}`);
            await database_1.default.messageQueue.update({
                where: { id: queueId },
                data: {
                    status: QueueStatus.FAILED,
                    retryCount: newRetryCount,
                    failedAt: new Date(),
                    errorMessage,
                    errorCode,
                },
            });
        }
    }
    // ============================================
    // CREATE CONVERSATION MESSAGE
    // ============================================
    async createConversationMessage(queueItem, waMessageId) {
        try {
            const { contact, whatsappAccount, template, templateParams } = queueItem;
            let conversation = await database_1.default.conversation.findFirst({
                where: {
                    organizationId: whatsappAccount.organizationId,
                    contactId: contact.id,
                },
            });
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organizationId: whatsappAccount.organizationId,
                        contactId: contact.id,
                        lastMessageAt: new Date(),
                        lastMessagePreview: `Template: ${template.name}`,
                        isRead: true,
                        unreadCount: 0,
                    },
                });
            }
            else {
                await database_1.default.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessagePreview: `Template: ${template.name}`,
                    },
                });
            }
            await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId: whatsappAccount.id,
                    waMessageId,
                    wamId: waMessageId,
                    direction: 'OUTBOUND',
                    type: 'TEMPLATE',
                    content: template.bodyText,
                    templateId: template.id,
                    templateName: template.name,
                    templateParams: templateParams,
                    status: client_1.MessageStatus.SENT,
                    sentAt: new Date(),
                },
            });
            console.log(`✅ Conversation message created for ${contact.phone}`);
        }
        catch (error) {
            console.error('❌ Error creating conversation message:', error);
        }
    }
    // ============================================
    // PARSE TEMPLATE PARAMS
    // ============================================
    parseTemplateParams(params) {
        if (!params)
            return undefined;
        try {
            if (typeof params === 'string') {
                return JSON.parse(params);
            }
            return params;
        }
        catch {
            return undefined;
        }
    }
    // ============================================
    // HELPER METHODS
    // ============================================
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ============================================
    // PUBLIC UTILITY METHODS
    // ============================================
    async addToQueue(data) {
        const queueItem = await database_1.default.messageQueue.create({
            data: {
                campaignId: data.campaignId || undefined,
                contactId: data.contactId,
                whatsappAccountId: data.whatsappAccountId,
                templateId: data.templateId,
                templateParams: data.templateParams || undefined,
                priority: data.priority || 0,
                status: QueueStatus.PENDING,
            },
        });
        console.log(`✅ Added to queue: ${queueItem.id}`);
        this.emit('message:queued', {
            queueId: queueItem.id,
            contactId: data.contactId,
        });
        return queueItem.id;
    }
    async addBatchToQueue(messages) {
        const queueItems = messages.map((msg) => ({
            campaignId: msg.campaignId || undefined,
            contactId: msg.contactId,
            whatsappAccountId: msg.whatsappAccountId,
            templateId: msg.templateId,
            templateParams: msg.templateParams || undefined,
            priority: msg.priority || 0,
            status: QueueStatus.PENDING,
        }));
        const result = await database_1.default.messageQueue.createMany({
            data: queueItems,
        });
        console.log(`✅ Added ${result.count} messages to queue`);
        this.emit('batch:queued', {
            count: result.count,
        });
        return result.count;
    }
    async getQueueStats() {
        const [pending, processing, sent, failed, total] = await Promise.all([
            database_1.default.messageQueue.count({ where: { status: QueueStatus.PENDING } }),
            database_1.default.messageQueue.count({ where: { status: QueueStatus.PROCESSING } }),
            database_1.default.messageQueue.count({ where: { status: QueueStatus.SENT } }),
            database_1.default.messageQueue.count({ where: { status: QueueStatus.FAILED } }),
            database_1.default.messageQueue.count(),
        ]);
        return {
            pending,
            processing,
            sent,
            failed,
            total,
            isRunning: this.isRunning,
            workers: this.config.concurrentWorkers,
        };
    }
    async cleanupOldMessages(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await database_1.default.messageQueue.deleteMany({
            where: {
                OR: [
                    { status: QueueStatus.SENT },
                    { status: QueueStatus.FAILED },
                ],
                createdAt: { lt: cutoffDate },
            },
        });
        console.log(`🗑️ Cleaned up ${result.count} old queue items`);
        return result.count;
    }
    async cancelPendingMessages(campaignId) {
        const result = await database_1.default.messageQueue.updateMany({
            where: {
                campaignId,
                status: { in: [QueueStatus.PENDING, QueueStatus.PROCESSING] },
            },
            data: {
                status: QueueStatus.CANCELLED,
            },
        });
        console.log(`❌ Cancelled ${result.count} pending messages for campaign ${campaignId}`);
        return result.count;
    }
    async retryFailedMessages(campaignId) {
        const where = {
            status: QueueStatus.FAILED,
            retryCount: { lt: this.config.maxRetries },
        };
        if (campaignId) {
            where.campaignId = campaignId;
        }
        const result = await database_1.default.messageQueue.updateMany({
            where,
            data: {
                status: QueueStatus.PENDING,
                nextRetryAt: new Date(),
            },
        });
        console.log(`🔄 Retrying ${result.count} failed messages`);
        return result.count;
    }
    async clearFailedMessages() {
        const result = await database_1.default.messageQueue.deleteMany({
            where: {
                status: QueueStatus.FAILED,
            },
        });
        console.log(`🗑️ Cleared ${result.count} failed messages`);
        return result.count;
    }
    async getHealthStatus() {
        const stats = await this.getQueueStats();
        return {
            status: this.isRunning ? 'RUNNING' : 'STOPPED',
            healthy: true,
            activeWorkers: this.workers.size,
            stats,
            uptime: process.uptime(),
            timestamp: new Date(),
        };
    }
}
exports.messageQueueWorker = new MessageQueueWorker();
exports.default = exports.messageQueueWorker;
//# sourceMappingURL=messageQueue.service.js.map