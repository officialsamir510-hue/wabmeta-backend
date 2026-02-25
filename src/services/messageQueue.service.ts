// src/services/messageQueue.service.ts

import Bull, { Job } from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import { whatsappApi } from '../modules/whatsapp/whatsapp.api';
import prisma from '../config/database';

// ✅ Create queue with Redis
const whatsappQueue = new Bull('whatsapp-messages', {
    redis: config.redis.url || 'redis://localhost:6379',
    limiter: {
        max: 80, // ✅ Meta allows 80 messages/sec (Cloud API)
        duration: 1000,
    },
});

// ✅ Process queue
whatsappQueue.process(async (job: Job) => {
    const data = job.data;
    console.log(`📨 Processing job ${job.id}:`, data);

    try {
        if (data.campaignId && data.contactId) {
            const contact = await prisma.contact.findUnique({ where: { id: data.contactId } });
            const campaign = await prisma.campaign.findUnique({
                where: { id: data.campaignId },
                include: { template: true, whatsappAccount: true }
            });

            if (!contact || !campaign) {
                throw new Error(`Missing data for campaign ${data.campaignId} / contact ${data.contactId}`);
            }

            console.log(`📤 Sending campaign message to ${contact.phone}`);
            // Logic to send template message via whatsappApi
            // This should be implemented properly based on your whatsappApi methods
        } else if (data.type === 'text') {
            await (whatsappApi as any).sendTextMessage(data.phoneNumberId, data.to, data.message, data.accessToken);
        }

        console.log(`✅ Job ${job.id} completed`);
    } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);
        throw error;
    }
});

// ✅ Worker interface
export const messageQueueWorker = Object.assign(new EventEmitter(), {
    isRunning: true,
    start: async () => {
        console.log('🚀 Bull Queue Worker is ready');
    },
    stop: async () => {
        await whatsappQueue.close();
    },
    addToQueue: async (data: any) => {
        return whatsappQueue.add(data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });
    },

    // ✅ Campaign specific methods needed by routes
    getQueueStats: async () => {
        const [pending, active, completed, failed, delayed] = await Promise.all([
            whatsappQueue.getJobCountByTypes(['waiting']),
            whatsappQueue.getJobCountByTypes(['active']),
            whatsappQueue.getJobCountByTypes(['completed']),
            whatsappQueue.getJobCountByTypes(['failed']),
            whatsappQueue.getJobCountByTypes(['delayed']),
        ]);
        const total = pending + active + completed + failed + delayed;
        return { pending, processing: active, sent: completed, failed, total };
    },

    retryFailedMessages: async (campaignId?: string) => {
        const failedJobs = await whatsappQueue.getFailed();
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
        const failedJobs = await whatsappQueue.getFailed();
        await Promise.all(failedJobs.map(job => job.remove()));
        return failedJobs.length;
    },

    getHealthStatus: async () => {
        const stats = await messageQueueWorker.getQueueStats();
        return {
            status: 'RUNNING',
            healthy: true,
            stats,
            timestamp: new Date(),
        };
    },

    whatsappQueue
});

export const addToWhatsAppQueue = messageQueueWorker.addToQueue;

export default messageQueueWorker;