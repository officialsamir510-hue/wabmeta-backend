// src/services/messageQueue.service.ts

import Bull, { Queue, Job } from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import whatsappApi from '../modules/whatsapp/whatsapp.api';
import prisma from '../config/database';

// ✅ Check if Redis is configured
const redisUrl = process.env.REDIS_URL || config.redis?.url;

if (!redisUrl) {
    console.warn('⚠️ Redis not configured. Message queue will NOT work!');
    console.warn('⚠️ Messages will NOT be sent automatically!');
}

// ✅ Create queue with optimized Redis config
const createRedisClient = () => {
    if (!redisUrl) return undefined;

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
export const messageQueue = new Bull('whatsapp-messages', redisUrl || 'redis://localhost:6379', {
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
messageQueue.process(async (job: Job) => {
    console.log(`📤 Processing message job: ${job.id}`);
    console.log(`📞 Phone: ${job.data.phone}`);

    const {
        campaignId,
        campaignContactId,
        phone,
        templateId,
        whatsappAccountId,
        organizationId,
        variables = {},
    } = job.data;

    try {
        // Get template
        const template = await prisma.template.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Get WhatsApp account
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: whatsappAccountId },
        });

        if (!account || !account.accessToken) {
            throw new Error(`WhatsApp account not found or no token: ${whatsappAccountId}`);
        }

        console.log(`📧 Sending template: ${template.name} to ${phone}`);

        // ✅ Build template components
        const components: any = {};

        // Map variables to template parameters
        const templateVars = (template as any).variables;
        if (templateVars && Array.isArray(templateVars) && Object.keys(variables).length > 0) {
            components.body = templateVars.map((varName: string) =>
                variables[varName] || ''
            );
        }

        // ✅ Decrypt token
        const { decrypt } = await import('../utils/encryption');
        const token = decrypt(account.accessToken);

        // ✅ Send message via WhatsApp API
        const result = await whatsappApi.sendTemplateMessage(
            account.phoneNumberId,
            phone,
            template.name,
            template.language,
            components,
            token || undefined
        );

        console.log(`✅ Message sent: ${result.waMessageId}`);

        // ✅ Update campaign contact
        await prisma.campaignContact.update({
            where: { id: campaignContactId },
            data: {
                status: 'SENT',
                waMessageId: result.waMessageId,
                sentAt: new Date(),
            },
        });

        // ✅ Create message record
        const conversation = await prisma.conversation.findFirst({
            where: {
                organizationId,
                contact: {
                    phone: {
                        in: [phone, `+91${phone}`, `91${phone}`],
                    },
                },
            },
        });

        if (conversation) {
            await prisma.message.create({
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
                    sentAt: new Date(),
                },
            });
        }

        console.log(`✅ Job ${job.id} completed successfully`);
        return { success: true, waMessageId: result.waMessageId };
    } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        // Update campaign contact as failed
        if (campaignContactId) {
            await prisma.campaignContact.update({
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
messageQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
});

messageQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

messageQueue.on('error', (error) => {
    console.error('❌ Queue error:', error);
});

// ✅ Export functions
export const addMessage = async (data: any) => {
    console.log(`➕ Adding message to queue: ${data.phone}`);

    const job = await messageQueue.add(data, {
        jobId: `${data.campaignId}-${data.phone}-${Date.now()}`,
    });

    console.log(`✅ Job created: ${job.id}`);
    return job;
};

export const getQueueStats = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        messageQueue.getWaitingCount(),
        messageQueue.getActiveCount(),
        messageQueue.getCompletedCount(),
        messageQueue.getFailedCount(),
        messageQueue.getDelayedCount(),
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

/**
 * messageQueueWorker object to maintain compatibility with server.ts and routes
 */
export const messageQueueWorker = Object.assign(new EventEmitter(), {
    isRunning: true,
    start: async () => {
        console.log('🚀 Message Queue Worker started');
    },
    stop: async () => {
        await messageQueue.close();
    },
    addToQueue: addMessage,
    getQueueStats,
    retryFailedMessages: async (campaignId?: string) => {
        const failedJobs = await messageQueue.getFailed();
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
        const failedJobs = await messageQueue.getFailed();
        await Promise.all(failedJobs.map(job => job.remove()));
        return failedJobs.length;
    },
    getHealthStatus: async () => {
        const stats = await getQueueStats();
        return {
            status: 'RUNNING',
            healthy: true,
            stats,
            timestamp: new Date(),
        };
    },
    whatsappQueue: messageQueue
});

export const addToWhatsAppQueue = addMessage;

export default messageQueue;