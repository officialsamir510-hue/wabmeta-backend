// 📁 src/modules/webhooks/webhook.service.ts - COMPLETE FIXED VERSION

import { PrismaClient, MessageStatus, MessageDirection, WebhookStatus } from '@prisma/client';
import { config } from '../../config';
import { verifyWebhookSignature, safeDecryptStrict, isMetaToken } from '../../utils/encryption';
import { metaApi } from '../meta/meta.api';
import { EventEmitter } from 'events';

export const webhookEvents = new EventEmitter();

const prisma = new PrismaClient();

// ============================================
// TYPES
// ============================================

interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

interface WebhookChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WebhookContact[];
    messages?: WebhookMessage[];
    statuses?: WebhookStatus[];
    errors?: WebhookError[];
  };
  field: string;
}

interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: any[];
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload: string };
  context?: { from: string; id: string };
}

interface WebhookMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WebhookError[];
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

interface WebhookError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

// ============================================
// WEBHOOK SERVICE CLASS
// ============================================

class WebhookService {
  // ============================================
  // VERIFY WEBHOOK (GET request from Meta)
  // ============================================
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = config.meta.webhookVerifyToken;

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
  async processWebhook(
    payload: any,
    signature: string | undefined
  ): Promise<{ success: boolean; processed: number }> {
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
        status: WebhookStatus.PROCESSING,
      },
    });

    try {
      // Verify signature in production
      if (config.app.isProduction && signature) {
        const isValid = verifyWebhookSignature(
          JSON.stringify(payload),
          signature,
          config.meta.appSecret
        );

        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          await this.updateWebhookLog(webhookLog.id, WebhookStatus.FAILED, 'Invalid signature');
          return { success: false, processed: 0 };
        }
      }

      // Only process WhatsApp Business Account webhooks
      if (payload?.object !== 'whatsapp_business_account') {
        console.log('⚠️ Ignoring non-WhatsApp webhook');
        await this.updateWebhookLog(webhookLog.id, WebhookStatus.SUCCESS);
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
          status: WebhookStatus.SUCCESS,
          processedAt: new Date(),
          responseTime: duration,
        },
      });

      console.log(`✅ Webhook processed: ${processedCount} items in ${duration}ms`);
      console.log('📨 ========== WEBHOOK END ==========\n');

      return { success: true, processed: processedCount };
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);

      await this.updateWebhookLog(
        webhookLog.id,
        WebhookStatus.FAILED,
        error.message
      );

      return { success: false, processed: 0 };
    }
  }

  // ============================================
  // PROCESS INCOMING MESSAGE
  // ============================================
  private async processIncomingMessage(
    account: any,
    message: WebhookMessage,
    contacts?: WebhookContact[]
  ) {
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
        // Create new contact
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
      } else if (contactName && !contact.firstName) {
        // Update contact name if available
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
      } else {
        // Update conversation
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
          direction: MessageDirection.INBOUND,
          type: this.mapMessageType(message.type),
          content: this.extractMessageContent(message),
          mediaUrl: await this.getMediaUrl(account, message),
          mediaType: message.type !== 'text' ? message.type : null,
          status: MessageStatus.DELIVERED,
          sentAt: new Date(parseInt(message.timestamp) * 1000),
          replyToMessageId: message.context?.id || null,
          metadata: {
            originalType: message.type,
            context: message.context || null,
          },
        },
      });

      console.log(`✅ Message saved: ${messageData.id}`);

      // Emit new message event
      webhookEvents.emit('newMessage', {
        organizationId: account.organizationId,
        conversationId: conversation.id,
        messages: [messageData]
      });

      // Update contact stats
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: now,
          messageCount: { increment: 1 },
        },
      });

      // TODO: Trigger chatbot/automation if needed
      // await this.triggerAutomations(account, contact, conversation, messageData);

    } catch (error: any) {
      console.error('❌ Error processing incoming message:', error);
    }
  }

  // ============================================
  // PROCESS MESSAGE STATUS UPDATE
  // ============================================
  private async processMessageStatus(account: any, status: WebhookMessageStatus) {
    try {
      console.log(`📊 Status update: ${status.id} -> ${status.status}`);

      const message = await prisma.message.findFirst({
        where: {
          OR: [
            { waMessageId: status.id },
            { wamId: status.id },
          ],
        },
      });

      if (!message) {
        console.warn(`⚠️ Message not found for status: ${status.id}`);
        return;
      }

      const timestamp = new Date(parseInt(status.timestamp) * 1000);

      const updateData: any = {
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
          updateData.failureReason = status.errors?.[0]?.message ||
            status.errors?.[0]?.title ||
            'Unknown error';
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
              windowExpiresAt: new Date(
                parseInt(status.conversation.expiration_timestamp) * 1000
              ),
              isWindowOpen: true,
            },
          });
        }
      }

      // Emit message status event
      webhookEvents.emit('messageStatus', {
        organizationId: account.organizationId,
        conversationId: message.conversationId,
        messageId: message.id,
        status: status.status,
        timestamp: timestamp
      });

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

        // Update campaign stats
        if (message.templateName) {
          await this.updateCampaignStats(message.conversationId, status.status);
        }
      }

    } catch (error: any) {
      console.error('❌ Error processing status update:', error);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async updateWebhookLog(
    id: string,
    status: WebhookStatus,
    errorMessage?: string
  ) {
    await prisma.webhookLog.update({
      where: { id },
      data: {
        status,
        processedAt: new Date(),
        errorMessage,
      },
    });
  }

  private mapMessageType(type: string): any {
    const typeMap: Record<string, any> = {
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

  private mapStatus(status: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    return statusMap[status] || MessageStatus.PENDING;
  }

  private getMessagePreview(message: WebhookMessage): string {
    if (message.text?.body) {
      return message.text.body.substring(0, 100);
    }

    const typeLabels: Record<string, string> = {
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

  private extractMessageContent(message: WebhookMessage): string {
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

  private async getMediaUrl(account: any, message: WebhookMessage): Promise<string | null> {
    let mediaId: string | null = null;

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
        mediaId = (message as any).sticker?.id || null;
        break;
    }

    if (!mediaId) return null;

    try {
      // Get access token
      const decryptedToken = safeDecryptStrict(account.accessToken);

      if (!decryptedToken) {
        console.error('❌ Failed to decrypt token for media retrieval');
        return null;
      }

      // Get media URL from Meta
      const mediaUrl = await metaApi.getMediaUrl(mediaId, decryptedToken);
      return mediaUrl;
    } catch (error) {
      console.error('❌ Error fetching media URL:', error);
      return null;
    }
  }

  private async updateCampaignStats(conversationId: string, status: string) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            where: {
              direction: MessageDirection.OUTBOUND,
              templateId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!conversation?.messages[0]) return;

      // Find campaign from message
      const campaignContact = await (prisma.campaignContact as any).findFirst({
        where: {
          waMessageId: conversation.messages[0].waMessageId,
        },
        include: { campaign: true },
      });

      if (!campaignContact) return;

      const updateField: Record<string, string> = {
        sent: 'sentCount',
        delivered: 'deliveredCount',
        read: 'readCount',
        failed: 'failedCount',
      };

      const field = updateField[status];
      if (field) {
        await prisma.campaign.update({
          where: { id: campaignContact.campaignId },
          data: {
            [field]: { increment: 1 },
          },
        });
      }
    } catch (error) {
      console.error('❌ Error updating campaign stats:', error);
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
    } catch (error) {
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

      const result = await (prisma.whatsAppAccount as any).updateMany({
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
    } catch (error) {
      console.error('❌ Error resetting limits:', error);
      return 0;
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;