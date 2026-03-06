// src/services/messageQueue.service.ts - COMPLETE FIXED VERSION

import Bull, { Queue, Job } from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import whatsappApi from '../modules/whatsapp/whatsapp.api';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption';
import { inboxService } from '../modules/inbox/inbox.service';
import { webhookEvents } from '../modules/webhooks/webhook.service';
import { campaignSocketService } from '../modules/campaigns/campaigns.socket';

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
messageQueue.process(80, async (job: Job) => {
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
        await inboxService.clearCache(organizationId);

        // ✅ 11. Emit socket events for real-time updates
        // webhookEvents is already imported at top level

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
        
        // ✅ 12. Emit individual contact status update for real-time campaign UI
        if (campaignId) {
            campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: contactId,
                phone: phone,
                status: 'SENT',
                messageId: result.waMessageId
            });
        }

        // ✅ 13. Update campaign stats (Optimized)
        if (campaignId) {
            await incrementCampaignStats(campaignId, 'sent');
        }

        console.log(`✅ Job ${job.id} completed successfully`);
        return { success: true, waMessageId: result.waMessageId };

    } catch (error: any) {
        let failureReason = error.message;
        
        // Detailed Meta error extraction
        if (error.response?.data?.error?.message) {
            failureReason = error.response.data.error.message;
        }
        
        // classify error
        if (failureReason.includes('400')) failureReason = `Meta API Error: ${failureReason}`;
        if (failureReason.includes('token') || failureReason.includes('OAuth')) failureReason = "WhatsApp account disconnected. Please reconnect.";
        if (failureReason.includes('limit')) failureReason = "Meta Rate Limit Reached. Messages will be delayed.";
        if (failureReason.includes('template')) failureReason = "Template mismatch or not approved by Meta.";
        if (failureReason.includes('permission')) failureReason = "Missing permissions to send messages.";
        if (failureReason.includes('user')) failureReason = "Invalid phone number or WhatsApp user not found.";
        if (failureReason.includes('policy')) failureReason = "Meta Policy Violation. Check your business account.";

        console.error(`❌ Job ${job.id} failed:`, failureReason);

        // Update campaign contact as failed
        if (campaignContactId) {
            try {
                await prisma.campaignContact.updateMany({
                    where: { id: campaignContactId },
                    data: {
                        status: 'FAILED',
                        failureReason: failureReason,
                        failedAt: new Date(),
                    },
                });

                // ✅ Emit individual contact failure for real-time campaign UI
                if (campaignId && organizationId) {
                    campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: contactId,
                        phone: phone,
                        status: 'FAILED',
                        error: failureReason
                    });
                }

                // Update campaign stats (Optimized)
                if (campaignId) {
                    await incrementCampaignStats(campaignId, 'failed');
                }
            } catch (updateError) {
                console.error('⚠️ Failed to update campaign contact status:', updateError);
            }
        }

        throw error; // Will be retried by Bull
    }
});

/**
 * Increment campaign stats atomically (MUCH FASTER than groupBy)
 */
/**
 * Increment campaign stats atomically (MUCH FASTER than groupBy)
 */
async function incrementCampaignStats(campaignId: string, type: 'sent' | 'failed') {
    try {
        const field = type === 'sent' ? 'sentCount' : 'failedCount';
        
        const campaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: { [field]: { increment: 1 } },
            select: {
                id: true,
                organizationId: true,
                sentCount: true,
                failedCount: true,
                totalContacts: true,
                status: true,
            }
        });

        // ✅ Emit progress update
        const processed = campaign.sentCount + campaign.failedCount;
        const percentage = Math.round((processed / (campaign.totalContacts || 1)) * 100);
        
        campaignSocketService.emitCampaignProgress(campaign.organizationId, campaignId, {
            sent: campaign.sentCount,
            failed: campaign.failedCount,
            total: campaign.totalContacts,
            percentage,
            status: campaign.status,
        });

        // ✅ Smarter completion check: only if we are at the end
        if (processed >= campaign.totalContacts && campaign.status !== 'COMPLETED') {
            const finalCampaign = await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            console.log(`🏁 Campaign ${campaignId} completed!`);

            campaignSocketService.emitCampaignCompleted(
                campaign.organizationId,
                campaignId,
                {
                    sentCount: finalCampaign.sentCount,
                    deliveredCount: finalCampaign.deliveredCount,
                    readCount: finalCampaign.readCount,
                    failedCount: finalCampaign.failedCount,
                    totalRecipients: finalCampaign.totalContacts,
                }
            );
        }
    } catch (error) {
        console.error('❌ Failed to increment campaign stats:', error);
    }
}

// Deprecated in favor of incrementCampaignStats but kept for compatibility if needed
async function updateCampaignStats(campaignId: string) {
    console.log('⚠️ updateCampaignStats called (Legacy), please use incrementCampaignStats');
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