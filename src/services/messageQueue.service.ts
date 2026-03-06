// src/services/messageQueue.service.ts - COMPLETE PRODUCTION FIXED VERSION

import Bull, { Job } from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import { metaApi } from '../modules/meta/meta.api';  // ✅ FIXED: Use metaApi
import prisma from '../config/database';
import { safeDecrypt } from '../utils/encryption';  // ✅ FIXED: Use safeDecrypt
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
        connectTimeout: 10000,
    },
    limiter: {
        max: 80, // Meta allows 80 messages/sec
        duration: 1000,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'fixed',   // ✅ FIXED: Use fixed delay, not exponential (prevents 5-6 min delays)
            delay: 3000,     // Wait 3s between retries (not 2s, 4s, 8s...)
        },
        removeOnComplete: 100,
        removeOnFail: 500,
        priority: 1,         // ✅ High priority
        delay: 0,            // ✅ No artificial delay on enqueue
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
 * ✅ FIXED: Build template components in CORRECT Meta API format
 */
function buildTemplateComponents(
    template: any,
    variables: Record<string, any>
): any[] {
    const bodyText = template.bodyText || '';
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];

    if (matches.length === 0) {
        return []; // No parameters needed
    }

    // Build parameters in Meta format
    const parameters = matches.map((_: string, index: number) => {
        const varIndex = index + 1;
        const value = variables[`var_${varIndex}`] ||
            variables[varIndex] ||
            variables[`${varIndex}`] ||
            'N/A';
        return {
            type: 'text',
            text: String(value)
        };
    });

    // Return in Meta format: array of components
    return [{
        type: 'body',
        parameters: parameters
    }];
}

/**
 * Helper: Check if token looks valid
 */
function isValidToken(token: string | null | undefined): boolean {
    if (!token) return false;
    return token.startsWith('EAA') || token.startsWith('EAAG');
}

// ============================================
// ✅ FIXED: PROCESS MESSAGE JOB
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

        if (template.status !== 'APPROVED') {
            throw new Error(`Template not approved: ${template.name} (status: ${template.status})`);
        }

        // ✅ 2. Get WhatsApp account
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: whatsappAccountId },
        });

        if (!account) {
            throw new Error(`WhatsApp account not found: ${whatsappAccountId}`);
        }

        if (!account.accessToken) {
            throw new Error(`No access token for account: ${whatsappAccountId}`);
        }

        if (account.status !== 'CONNECTED') {
            throw new Error(`WhatsApp account not connected. Status: ${account.status}`);
        }

        // ✅ 3. Decrypt access token SAFELY
        let accessToken: string | null = null;

        // Check if already plain text (starts with EAA)
        if (isValidToken(account.accessToken)) {
            accessToken = account.accessToken;
            console.log(`📝 Token is already plain text`);
        } else {
            // Try to decrypt
            accessToken = safeDecrypt(account.accessToken);
            console.log(`🔓 Token decrypted`);
        }

        if (!isValidToken(accessToken)) {
            throw new Error('Invalid access token. Please reconnect WhatsApp account in Settings.');
        }

        // ✅ 4. Get or create conversation BEFORE sending
        const conversation = await getOrCreateConversation(organizationId, contactId);
        console.log(`💬 Using conversation: ${conversation.id}`);

        // ✅ 5. Build template components in CORRECT Meta format
        const components = buildTemplateComponents(template, variables);

        console.log(`📧 Sending template: ${template.name} with ${components.length > 0 ? components[0].parameters?.length || 0 : 0} params`);

        // ✅ 6. Format phone number (remove all non-digits)
        const formattedPhone = phone.replace(/[^0-9]/g, '');

        // ✅ 7. Send message via Meta API (CORRECT METHOD!)
        const result = await metaApi.sendMessage(
            account.phoneNumberId,
            accessToken!,
            formattedPhone,
            {
                type: 'template',
                template: {
                    name: template.name,
                    language: {
                        code: template.language || 'en_US'
                    },
                    components: components
                }
            }
        );

        const waMessageId = result.messageId;
        console.log(`✅ Message sent: ${waMessageId}`);

        // ✅ 8. Update campaign contact status
        await prisma.campaignContact.updateMany({
            where: { id: campaignContactId },
            data: {
                status: 'SENT',
                waMessageId: waMessageId,
                sentAt: new Date(),
            },
        });

        // ✅ 9. Save message to database with conversation link
        const now = new Date();
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                whatsappAccountId,
                waMessageId: waMessageId,
                wamId: waMessageId,
                direction: 'OUTBOUND',
                type: 'TEMPLATE',
                content: template.bodyText || `Template: ${template.name}`, // ✅ Store readable text
                status: 'SENT',
                sentAt: now,
                timestamp: now,
                templateId: template.id,
                metadata: {
                    campaignId,
                    campaignContactId,
                    templateName: template.name,
                    templateLanguage: template.language,
                },
            },
        });

        console.log(`💾 Message saved to DB: ${savedMessage.id}`);

        // ✅ 10. Update conversation preview
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: now,
                lastMessagePreview: `Template: ${template.name}`,
                isWindowOpen: true,
                windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
        });

        // ✅ 11. Clear inbox cache
        try {
            await inboxService.clearCache(organizationId);
        } catch (cacheErr) {
            console.warn('⚠️ Failed to clear cache:', cacheErr);
        }

        // ✅ 12. Emit socket events for real-time updates
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
            webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                message: savedMessage,
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

        // ✅ 13. Emit individual contact status for campaign UI
        if (campaignId) {
            campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: contactId,
                phone: phone,
                status: 'SENT',
                messageId: waMessageId
            });
        }

        // ✅ 14. Update campaign stats
        if (campaignId) {
            await incrementCampaignStats(campaignId, 'sent');
        }

        console.log(`✅ Job ${job.id} completed successfully`);
        return { success: true, waMessageId: waMessageId };

    } catch (error: any) {
        // ✅ IMPROVED: Better error extraction
        let failureReason = error.message || 'Unknown error';

        // Extract Meta API error details
        if (error.response?.data?.error) {
            const metaErr = error.response.data.error;
            const code = metaErr.code ? ` (Code: ${metaErr.code})` : '';
            const subcode = metaErr.error_subcode ? ` [Subcode: ${metaErr.error_subcode}]` : '';
            failureReason = `${metaErr.message}${code}${subcode}`;
        }

        // Human-readable overrides for common errors
        if (failureReason.includes('OAuthException') || error.response?.status === 401) {
            failureReason = `WhatsApp account disconnected. Please reconnect in Settings. (Original: ${failureReason})`;
        } else if (failureReason.includes('rate') || failureReason.includes('spam') || failureReason.includes('limit')) {
            failureReason = `Rate limit reached. Message will be retried. (${failureReason})`;
        } else if (failureReason.includes('131047') || failureReason.includes('Re-engagement')) {
            failureReason = `User hasn't messaged in 24 hours. Use a Marketing template instead.`;
        } else if (failureReason.includes('132000') || failureReason.includes('template')) {
            failureReason = `Template error: ${failureReason}`;
        } else if (failureReason.includes('131026') || failureReason.includes('not valid')) {
            failureReason = `Invalid phone number or user doesn't have WhatsApp.`;
        }

        console.error(`❌ Job ${job.id} failed:`, failureReason);

        // Update campaign contact as failed
        if (campaignContactId) {
            try {
                await prisma.campaignContact.updateMany({
                    where: { id: campaignContactId },
                    data: {
                        status: 'FAILED',
                        failureReason: failureReason.substring(0, 500), // Limit length
                        failedAt: new Date(),
                    },
                });

                // Emit failure to campaign UI
                if (campaignId && organizationId) {
                    campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: contactId,
                        phone: phone,
                        status: 'FAILED',
                        error: failureReason
                    });
                }

                // Update campaign stats
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
 * ✅ Increment campaign stats atomically
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
                deliveredCount: true,
                readCount: true,
                totalContacts: true,
                status: true,
            }
        });

        // Emit progress update
        const processed = campaign.sentCount + campaign.failedCount;
        const percentage = Math.round((processed / (campaign.totalContacts || 1)) * 100);

        campaignSocketService.emitCampaignProgress(campaign.organizationId, campaignId, {
            sent: campaign.sentCount,
            failed: campaign.failedCount,
            delivered: campaign.deliveredCount,
            read: campaign.readCount,
            total: campaign.totalContacts,
            percentage,
            status: campaign.status,
        });

        // Check completion
        if (processed >= campaign.totalContacts && campaign.status === 'RUNNING') {
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

// ============================================
// EVENT LISTENERS
// ============================================
messageQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result?.waMessageId || 'success');
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

messageQueue.on('stalled', (job) => {
    console.warn(`⚠️ Job ${job.id} stalled`);
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