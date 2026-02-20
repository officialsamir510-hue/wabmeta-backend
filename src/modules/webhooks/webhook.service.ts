// 📁 src/modules/webhooks/webhook.service.ts - FIXED (NO DUPLICATE CONTACTS ON REPLY)

import { PrismaClient, MessageStatus, MessageDirection, WebhookStatus } from '@prisma/client';
import { config } from '../../config';
import { verifyWebhookSignature, safeDecryptStrict } from '../../utils/encryption';
import { metaApi } from '../meta/meta.api';
import { EventEmitter } from 'events';
import { buildINPhoneVariants, normalizeINNational10 } from '../../utils/phone';

export const webhookEvents = new EventEmitter();
webhookEvents.setMaxListeners(20);

import prisma from '../../config/database';

// ============================================
// TYPES
// ============================================

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
  errors?: { code: number; title: string; message?: string }[];
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
}

// ============================================
// WEBHOOK SERVICE CLASS
// ============================================

class WebhookService {
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = config.meta.webhookVerifyToken;

    if (mode === 'subscribe' && token === verifyToken) return challenge;
    return null;
  }

  async processWebhook(
    payload: any,
    signature: string | undefined
  ): Promise<{ success: boolean; processed: number }> {
    const startTime = Date.now();

    const webhookLog = await prisma.webhookLog.create({
      data: {
        source: 'META',
        eventType: payload?.object || 'unknown',
        payload,
        status: WebhookStatus.PROCESSING,
      },
    });

    try {
      if (config.app.isProduction && signature) {
        const isValid = verifyWebhookSignature(JSON.stringify(payload), signature, config.meta.appSecret);
        if (!isValid) {
          await this.updateWebhookLog(webhookLog.id, WebhookStatus.FAILED, 'Invalid signature');
          return { success: false, processed: 0 };
        }
      }

      if (payload?.object !== 'whatsapp_business_account') {
        await this.updateWebhookLog(webhookLog.id, WebhookStatus.SUCCESS);
        return { success: true, processed: 0 };
      }

      let processedCount = 0;

      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id;

          const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneNumberId },
          });

          if (!account) continue;

          await prisma.webhookLog.update({
            where: { id: webhookLog.id },
            data: { organizationId: account.organizationId },
          });

          if (value.messages) {
            for (const message of value.messages as WebhookMessage[]) {
              await this.processIncomingMessage(account, message, value.contacts);
              processedCount++;
            }
          }

          if (value.statuses) {
            for (const status of value.statuses as WebhookMessageStatus[]) {
              await this.processMessageStatus(account, status);
              processedCount++;
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: WebhookStatus.SUCCESS, processedAt: new Date(), responseTime: duration },
      });

      return { success: true, processed: processedCount };
    } catch (error: any) {
      await this.updateWebhookLog(webhookLog.id, WebhookStatus.FAILED, error.message);
      return { success: false, processed: 0 };
    }
  }

  // ============================================
  // PROCESS INCOMING MESSAGE ✅ FIXED CONTACT LOOKUP
  // ============================================
  private async processIncomingMessage(account: any, message: WebhookMessage, contacts?: WebhookContact[]) {
    try {
      const waFrom = String(message.from || '').trim(); // usually "91xxxxxxxxxx"
      const variants = buildINPhoneVariants(waFrom);

      const contactInfo = contacts?.find((c) => String(c.wa_id) === waFrom);
      const contactName = contactInfo?.profile?.name;

      // ✅ Find contact across all legacy formats
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId: account.organizationId,
          OR: variants.map((p) => ({ phone: p })),
        },
      });

      // ✅ Create canonical (phone=10digit) if not found
      if (!contact) {
        const phone10 = normalizeINNational10(waFrom);

        if (!phone10) {
          // If WhatsApp sends something unexpected, skip contact creation safely
          console.warn('⚠️ Invalid inbound phone, skipping contact create:', waFrom);
          return;
        }

        contact = await prisma.contact.create({
          data: {
            organizationId: account.organizationId,
            phone: phone10,          // ✅ canonical
            countryCode: '+91',
            firstName: contactName || 'Unknown',
            source: 'WHATSAPP',
            status: 'ACTIVE',
          },
        });
      }

      // Conversation
      let conversation = await prisma.conversation.findFirst({
        where: { organizationId: account.organizationId, contactId: contact.id },
      });

      const now = new Date();
      const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
      } else {
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

      // Duplicate message protection
      const existingMessage = await prisma.message.findFirst({
        where: { waMessageId: message.id },
      });
      if (existingMessage) return;

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
          metadata: { originalType: message.type, context: message.context || null },
        },
      });

      webhookEvents.emit('newMessage', { ...messageData, organizationId: account.organizationId });

      // Update contact stats
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastMessageAt: now, messageCount: { increment: 1 } },
      });
    } catch (error: any) {
      console.error('❌ Error processing incoming message:', error);
    }
  }

  // ============================================
  // STATUS UPDATES (same as your current logic)
  // ============================================
  private async processMessageStatus(account: any, status: WebhookMessageStatus) {
    try {
      const message = await prisma.message.findFirst({
        where: { OR: [{ waMessageId: status.id }, { wamId: status.id }] },
      });

      if (!message) {
        await this.updateCampaignContactStatus(status);
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
          updateData.failureReason = status.errors?.[0]?.message || status.errors?.[0]?.title || 'Unknown error';
          break;
      }

      await prisma.message.update({ where: { id: message.id }, data: updateData });

      if (status.conversation?.expiration_timestamp) {
        await prisma.conversation.update({
          where: { id: message.conversationId },
          data: {
            windowExpiresAt: new Date(parseInt(status.conversation.expiration_timestamp) * 1000),
            isWindowOpen: true,
          },
        }).catch(() => { });
      }

      webhookEvents.emit('messageStatus', {
        messageId: message.id,
        waMessageId: status.id,
        status: this.mapStatus(status.status),
        organizationId: account.organizationId,
        conversationId: message.conversationId,
      });
    } catch (error: any) {
      console.error('❌ Error processing status update:', error.message);
    }
  }

  private async updateCampaignContactStatus(status: WebhookMessageStatus) {
    try {
      const timestamp = new Date(parseInt(status.timestamp) * 1000);
      const mappedStatus = this.mapStatus(status.status);

      const updateData: any = { status: mappedStatus };

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
          updateData.failureReason = status.errors?.[0]?.message || 'Delivery failed';
          break;
      }

      await prisma.campaignContact.updateMany({
        where: { waMessageId: status.id },
        data: updateData,
      });
    } catch (error: any) {
      // silent
    }
  }

  // ============================================
  // CRON MAINTENANCE
  // ============================================

  async expireConversationWindows(): Promise<number> {
    try {
      const result = await prisma.conversation.updateMany({
        where: {
          isWindowOpen: true,
          windowExpiresAt: { lt: new Date() },
        },
        data: { isWindowOpen: false },
      });
      return result.count;
    } catch (error) {
      console.error('❌ Error expiring conversation windows:', error);
      throw error;
    }
  }

  async resetDailyMessageLimits(): Promise<number> {
    try {
      // Reset all accounts' usage counts to 0
      const result = await prisma.whatsAppAccount.updateMany({
        data: {
          dailyMessagesUsed: 0,
          lastLimitReset: new Date(),
        },
      });
      return result.count;
    } catch (error) {
      console.error('❌ Error resetting daily limits:', error);
      throw error;
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  private async updateWebhookLog(id: string, status: WebhookStatus, errorMessage?: string) {
    await prisma.webhookLog.update({
      where: { id },
      data: { status, processedAt: new Date(), errorMessage },
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
    if (message.text?.body) return message.text.body.substring(0, 100);
    const typeLabels: Record<string, string> = {
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      document: 'Document',
      sticker: 'Sticker',
      location: 'Location',
      contacts: 'Contact',
      interactive: 'Interactive',
    };
    return typeLabels[message.type] || message.type;
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
        if (message.interactive?.button_reply) return message.interactive.button_reply.title;
        if (message.interactive?.list_reply) return message.interactive.list_reply.title;
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
      const decryptedToken = safeDecryptStrict(account.accessToken);
      if (!decryptedToken) return null;
      return await metaApi.getMediaUrl(mediaId, decryptedToken);
    } catch {
      return null;
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;