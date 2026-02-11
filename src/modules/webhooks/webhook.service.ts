// src/modules/webhooks/webhook.service.ts

import { PrismaClient, MessageStatus, MessageDirection, MessageType } from '@prisma/client';
import { decrypt } from '../../utils/encryption';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export const webhookEvents = new EventEmitter();

interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

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
    contacts?: Array<{
      profile: { name: string };
      wa_id: string;
    }>;
    messages?: WebhookMessage[];
    statuses?: WebhookStatus[];
  };
  field: string;
}

interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; filename: string; mime_type: string; sha256: string; caption?: string };
  sticker?: { id: string; mime_type: string; sha256: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: any[];
  interactive?: { type: string; button_reply?: any; list_reply?: any };
  button?: { text: string; payload: string };
}

interface WebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  errors?: Array<{ code: number; title: string }>;
}

class WebhookService {
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Verification successful');
      return challenge;
    }
    console.log('[Webhook] Verification failed');
    return null;
  }

  async processWebhook(payload: WebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      console.log('[Webhook] Ignoring non-WhatsApp payload');
      return;
    }
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await this.processMessagesChange(change.value);
        }
      }
    }
  }

  private async processMessagesChange(value: WebhookChange['value']): Promise<void> {
    const { metadata, contacts, messages, statuses } = value;
    const phoneNumberId = metadata.phone_number_id;

    const account = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
      include: { organization: true },
    });

    if (!account) {
      console.log(`[Webhook] No account found for phone number ID: ${phoneNumberId}`);
      return;
    }

    if (messages && messages.length > 0) {
      for (const message of messages) {
        await this.processIncomingMessage(account, message, contacts?.[0]);
      }
    }

    if (statuses && statuses.length > 0) {
      for (const status of statuses) {
        await this.processStatusUpdate(account, status);
      }
    }
  }

  private async processIncomingMessage(
    account: any,
    message: WebhookMessage,
    contactInfo?: { profile: { name: string }; wa_id: string }
  ): Promise<void> {
    try {
      const waId = message.from;
      const phone = '+' + waId;

      // Find or create contact
      let contact = await prisma.contact.findUnique({
        where: {
          organizationId_phone: {
            organizationId: account.organizationId,
            phone,
          },
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId: account.organizationId,
            phone,
            firstName: contactInfo?.profile?.name || null,  // ✅ Fixed
            source: 'WHATSAPP',
          },
        });
      } else if (contactInfo?.profile?.name && !contact.firstName) {  // ✅ Fixed
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: { firstName: contactInfo.profile.name },  // ✅ Fixed
        });
      }

      // Find or create conversation
      let conversation = await prisma.conversation.findUnique({
        where: {
          organizationId_contactId: {  // ✅ Fixed
            organizationId: account.organizationId,
            contactId: contact.id,
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: account.organizationId,
            phoneNumberId: account.phoneNumberId,  // ✅ Fixed
            contactId: contact.id,
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isWindowOpen: true,
            unreadCount: 1,
            lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
            lastMessagePreview: this.getMessagePreview(message),  // ✅ Fixed
          },
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isWindowOpen: true,
            unreadCount: { increment: 1 },
            lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
            lastMessagePreview: this.getMessagePreview(message),  // ✅ Fixed
          },
        });
      }

      const existingMessage = await prisma.message.findUnique({
        where: { wamId: message.id },
      });

      if (existingMessage) {
        console.log(`[Webhook] Duplicate message ignored: ${message.id}`);
        return;
      }

      const newMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: account.id,
          wamId: message.id,
          direction: 'INBOUND',
          type: this.mapMessageType(message.type),
          content: JSON.stringify(this.extractMessageContent(message)),
          status: 'DELIVERED',
          sentAt: new Date(parseInt(message.timestamp) * 1000),
        },
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
      });

      webhookEvents.emit('newMessage', {
        organizationId: account.organizationId,
        accountId: account.id,
        conversationId: conversation.id,
        message: newMessage,
      });

      console.log(`[Webhook] New message saved: ${message.id}`);
    } catch (error) {
      console.error('[Webhook] Error processing message:', error);
    }
  }

  private async processStatusUpdate(account: any, status: WebhookStatus): Promise<void> {
    try {
      const message = await prisma.message.findUnique({
        where: { wamId: status.id },
      });

      if (!message) {
        console.log(`[Webhook] Message not found for status update: ${status.id}`);
        return;
      }

      const statusMap: Record<string, MessageStatus> = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
      };

      const updateData: any = {
        status: statusMap[status.status] || message.status,
        statusUpdatedAt: new Date(),
      };

      if (status.status === 'sent') {
        updateData.sentAt = new Date(parseInt(status.timestamp) * 1000);
      } else if (status.status === 'delivered') {
        updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
      } else if (status.status === 'read') {
        updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
      } else if (status.status === 'failed' && status.errors?.[0]) {
        updateData.failureReason = status.errors[0].title;
      }

      await prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // ✅ Fixed: campaignRecipient → campaignContact
      await prisma.campaignContact.updateMany({
        where: { waMessageId: status.id },
        data: {
          status: status.status === 'read' ? 'READ' :
                 status.status === 'delivered' ? 'DELIVERED' :
                 status.status === 'sent' ? 'SENT' :
                 status.status === 'failed' ? 'FAILED' : 'PENDING',
          ...(status.status === 'delivered' && { deliveredAt: new Date() }),
          ...(status.status === 'read' && { readAt: new Date() }),
          ...(status.status === 'failed' && {
            failedAt: new Date(),
            failureReason: status.errors?.[0]?.title,
          }),
        },
      });

      webhookEvents.emit('messageStatus', {
        organizationId: account.organizationId,
        messageId: message.id,
        wamId: status.id,
        status: status.status,
      });

      console.log(`[Webhook] Status updated: ${status.id} -> ${status.status}`);
    } catch (error) {
      console.error('[Webhook] Error processing status:', error);
    }
  }

  // ✅ Fixed: MessageType enum values
  private mapMessageType(type: string): MessageType {
    const typeMap: Record<string, MessageType> = {
      text: 'TEXT',
      image: 'IMAGE',
      video: 'VIDEO',
      audio: 'AUDIO',
      document: 'DOCUMENT',
      sticker: 'STICKER',
      location: 'LOCATION',
      contacts: 'CONTACT',  // ✅ Fixed: CONTACTS → CONTACT
      interactive: 'INTERACTIVE',
      button: 'INTERACTIVE',
      reaction: 'TEXT',  // ✅ Fixed: REACTION → TEXT
    };
    return typeMap[type] || 'TEXT';
  }

  private extractMessageContent(message: WebhookMessage): any {
    switch (message.type) {
      case 'text':
        return { text: message.text?.body };
      case 'image':
        return { mediaId: message.image?.id, caption: message.image?.caption };
      case 'video':
        return { mediaId: message.video?.id, caption: message.video?.caption };
      case 'audio':
        return { mediaId: message.audio?.id };
      case 'document':
        return {
          mediaId: message.document?.id,
          filename: message.document?.filename,
          caption: message.document?.caption,
        };
      case 'sticker':
        return { mediaId: message.sticker?.id };
      case 'location':
        return message.location;
      case 'contacts':
        return { contacts: message.contacts };
      case 'interactive':
        return message.interactive;
      case 'button':
        return { button: message.button };
      default:
        return {};
    }
  }

  private getMessagePreview(message: WebhookMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body?.substring(0, 100) || '';
      case 'image':
        return '📷 Image';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'document':
        return `📄 ${message.document?.filename || 'Document'}`;
      case 'sticker':
        return '🏷️ Sticker';
      case 'location':
        return '📍 Location';
      case 'contacts':
        return '👤 Contact';
      default:
        return 'New message';
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;