// src/services/messageQueue.service.ts - COMPLETE FIXED VERSION

import Bull, { Queue, Job } from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import whatsappApi from '../modules/whatsapp/whatsapp.api';
import prisma from '../config/database';

// ============================================
// REDIS CONFIGURATION
// ============================================
const redisUrl = process.env.REDIS_URL || config.redis?.url;

if (!redisUrl) {
    console.warn('⚠️ Redis not configured. Message queue will NOT work!');
    console.warn('⚠️ Messages will NOT be sent automatically!');
}

// ============================================
// CREATE BULL QUEUE
// ============================================
export const messageQueue = new Bull('whatsapp-messages', redisUrl || 'redis://localhost:6379', {
    redis: {
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
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get or create conversation for campaign message
 */
async function getOrCreateConversation(
    organizationId: string,
    contactId: string
): Promise<any> {
    let conversation = await prisma.conversation.findUnique({
        where: {
            organizationId_contactId: {
                organizationId,
                contactId,
            },
        },
    });

    if (!conversation) {
        const now = new Date();
        conversation = await prisma.conversation.create({
            data: {
                organizationId,
                contactId,
                lastMessageAt: now,
                lastMessagePreview: 'Campaign Message',
                unreadCount: 0,
                isRead: true,
                isWindowOpen: true,
                windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
        });
        console.log(`✅ Created conversation: ${conversation.id}`);
    } else {
        // Update existing conversation window
        const now = new Date();
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: now,
                isWindowOpen: true,
                windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
        });
    }

    return conversation;
}

/**
 * Build template parameters from variables
 */
function buildTemplateParams(template: any, variables: Record<string, any>): any[] {
    const params: any[] = [];

    // Extract variable count from template body
    const bodyText = template.bodyText || '';
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const varCount = matches.length;

    if (varCount === 0) {
        return []; // No parameters needed
    }

    // Build parameters array
    for (let i = 1; i <= varCount; i++) {
        const value = variables[`var_${i}`] || variables[i] || 'N/A';
        params.push(value);
    }

    return params;
}

// ============================================
// PROCESS MESSAGE JOB
// ============================================
messageQueue.process(20, async (job: Job) => {
    console.log(`📤 Processing message job: ${job.id}`);

    const {
        campaignId,
        campaignContactId,
        contactId,
        phone,
        templateId,
        whatsappAccountId,
        organizationId,
        variables = {},
    } = job.data;

    console.log(`📞 Sending to: ${phone}`);
    console.log(`📋 Template ID: ${templateId}`);

    try {
        // ✅ 1. Get template details
        const template = await prisma.template.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // ✅ 2. Get WhatsApp account
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: whatsappAccountId },
        });

        if (!account || !account.accessToken) {
            throw new Error(`WhatsApp account not found or no token: ${whatsappAccountId}`);
        }

        // ✅ 3. Get or create conversation BEFORE sending
        const conversation = await getOrCreateConversation(organizationId, contactId);
        console.log(`💬 Using conversation: ${conversation.id}`);

        // ✅ 4. Build template components
        const params = buildTemplateParams(template, variables);
        const components = params.length > 0 ? {
            body: params
        } : undefined;

        console.log(`📧 Sending template: ${template.name} with ${params.length} params`);

        // ✅ 5. Decrypt access token
        const { decrypt } = await import('../utils/encryption');
        const token = decrypt(account.accessToken) || undefined;

        // ✅ 6. Send message via WhatsApp API
        const result = await whatsappApi.sendTemplateMessage(
            account.phoneNumberId,
            phone,
            template.name || '',
            template.language || 'en',
            components,
            token
        );

        console.log(`✅ Message sent: ${result.waMessageId}`);

        // ✅ 7. Update campaign contact status
        await prisma.campaignContact.updateMany({
            where: { id: campaignContactId },
            data: {
                status: 'SENT',
                waMessageId: result.waMessageId,
                sentAt: new Date(),
            },
        });

        // ✅ 8. Save message to database with conversation link
        const now = new Date();
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id, // ✅ CRITICAL!
                whatsappAccountId,
                waMessageId: result.waMessageId,
                wamId: result.waMessageId,
                direction: 'OUTBOUND',
                type: 'TEMPLATE',
                content: JSON.stringify({
                    templateName: template.name,
                    language: template.language,
                    params,
                    body: template.bodyText, // Store body for UI display
                }),
                status: 'SENT',
                sentAt: now,
                timestamp: now,
                templateId: template.id,
                metadata: {
                    campaignId,
                    campaignContactId,
                },
            },
        });

        console.log(`💾 Message saved to DB: ${savedMessage.id}`);

        // ✅ 9. Update conversation preview
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: now,
                lastMessagePreview: `Template: ${template.name}`,
                isWindowOpen: true,
                windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
        });

        // ✅ 10. Clear inbox cache
        const { inboxService } = await import('../modules/inbox/inbox.service');
        await inboxService.clearCache(organizationId);

        // ✅ 11. Emit socket events for real-time updates
        const { webhookEvents } = await import('../modules/webhooks/webhook.service');

        // Get full conversation with contact for socket event
        const updatedConversation = await prisma.conversation.findUnique({
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
            // Emit new message event
            webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                message: {
                    ...savedMessage,
                },
            });

            // Emit conversation update event
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

        // ✅ 12. Update campaign stats
        if (campaignId) {
            await updateCampaignStats(campaignId);
        }

        console.log(`✅ Job ${job.id} completed successfully`);
        return { success: true, waMessageId: result.waMessageId };

    } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        // Update campaign contact as failed
        if (campaignContactId) {
            try {
                await prisma.campaignContact.updateMany({
                    where: { id: campaignContactId },
                    data: {
                        status: 'FAILED',
                        failureReason: error.message,
                        failedAt: new Date(),
                    },
                });

                // Update campaign stats
                if (campaignId) {
                    await updateCampaignStats(campaignId);
                }
            } catch (updateError) {
                console.error('⚠️ Failed to update campaign contact status:', updateError);
            }
        }

        throw error; // Will be retried by Bull
    }
});

// ============================================
// UPDATE CAMPAIGN STATS
// ============================================
async function updateCampaignStats(campaignId: string) {
    try {
        const stats = await prisma.campaignContact.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: true,
        });

        const statusCounts: Record<string, number> = {};
        stats.forEach((stat) => {
            statusCounts[stat.status] = stat._count;
        });

        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                sentCount: statusCounts.SENT || 0,
                deliveredCount: statusCounts.DELIVERED || 0,
                readCount: statusCounts.READ || 0,
                failedCount: statusCounts.FAILED || 0,
            },
        });

        console.log('📊 Campaign stats updated:', statusCounts);

        // Check if campaign should be marked complete
        const pendingCount = await prisma.campaignContact.count({
            where: {
                campaignId,
                status: { in: ['PENDING', 'QUEUED'] }
            },
        });

        if (pendingCount === 0) {
            const campaign = await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
                select: {
                    organizationId: true,
                    sentCount: true,
                    deliveredCount: true,
                    readCount: true,
                    failedCount: true,
                    totalContacts: true,
                },
            });

            console.log(`🏁 Campaign ${campaignId} completed!`);

            // Emit completion event
            const { campaignSocketService } = await import('../modules/campaigns/campaigns.socket');
            campaignSocketService.emitCampaignCompleted(
                campaign.organizationId,
                campaignId,
                {
                    sentCount: campaign.sentCount,
                    deliveredCount: campaign.deliveredCount,
                    readCount: campaign.readCount,
                    failedCount: campaign.failedCount,
                    totalRecipients: campaign.totalContacts,
                }
            );
        }
    } catch (error) {
        console.error('❌ Failed to update campaign stats:', error);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
messageQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
});

messageQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

messageQueue.on('error', (error) => {
    console.error('❌ Queue error:', error);
});

messageQueue.on('active', (job) => {
    console.log(`⚡ Job ${job.id} is now active`);
});

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Add message to queue
 */
export const addMessage = async (data: {
    campaignId: string;
    campaignContactId: string;
    contactId: string;
    phone: string;
    templateId: string;
    whatsappAccountId: string;
    organizationId: string;
    variables?: Record<string, any>;
}) => {
    console.log(`➕ Adding message to queue: ${data.phone}`);

    const job = await messageQueue.add(data, {
        jobId: `${data.campaignId}-${data.contactId}-${Date.now()}`,
    });

    console.log(`✅ Job created: ${job.id}`);
    return job;
};

/**
 * Get queue statistics
 */
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
        pending: waiting,
        processing: active,
        sent: completed,
    };
};

/**
 * Message Queue Worker - Compatibility object
 */
export const messageQueueWorker = Object.assign(new EventEmitter(), {
    isRunning: true,

    start: async () => {
        console.log('🚀 Message Queue Worker started');
    },

    stop: async () => {
        await messageQueue.close();
        console.log('⏹️ Message Queue Worker stopped');
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
        console.log(`🔄 Retried ${count} failed messages`);
        return count;
    },

    clearFailedMessages: async () => {
        const failedJobs = await messageQueue.getFailed();
        await Promise.all(failedJobs.map(job => job.remove()));
        console.log(`🗑️ Cleared ${failedJobs.length} failed messages`);
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

    whatsappQueue: messageQueue,
});

export const addToWhatsAppQueue = addMessage;

export default messageQueue;