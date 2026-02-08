// src/modules/webhooks/webhook.service.ts

import prisma from '../../config/database';
import { MessageStatus, MessageType } from '@prisma/client';
import crypto from 'crypto';

export class WebhookService {
  /**
   * Verify webhook signature from Meta
   * NOTE: "body" must be RAW string for signature verification.
   */
  static verifySignature(signature: string, body: string): boolean {
    if (!process.env.META_APP_SECRET) {
      console.warn('⚠️ META_APP_SECRET not set, skipping signature verification');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(body)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Emit Socket.IO events
   */
  private static emitSocketEvent(event: string, room: string, data: any) {
    try {
      const io = (global as any).io;
      if (io) io.to(room).emit(event, data);
    } catch (error) {
      console.error('Error emitting socket event:', error);
    }
  }

  /**
   * Process incoming webhook from Meta
   * Meta sends: entry[].changes[].value  (value may include: messages, statuses, etc.)
   */
  static async processMetaWebhook(payload: any) {
    const startTime = Date.now();
    let webhookLogId: string | undefined;

    try {
      const entry = payload?.entry;
      if (!Array.isArray(entry)) return;

      for (const entryItem of entry) {
        const wabaId = String(entryItem?.id || '');
        const changes = entryItem?.changes;

        if (!wabaId || !Array.isArray(changes)) continue;

        // Find organization by WABA ID
        const metaConnection = await prisma.metaConnection.findFirst({
          where: { wabaId },
          include: { phoneNumbers: true },
        });

        if (!metaConnection) {
          console.error('No organization found for WABA:', wabaId);
          continue;
        }

        const organizationId = metaConnection.organizationId;

        // Create webhook log once per entry
        const log = await prisma.webhookLog.create({
          data: {
            organizationId,
            source: 'META',
            eventType: 'webhook_received',
            payload,
            status: 'PROCESSING',
          },
        });
        webhookLogId = log.id;

        for (const change of changes) {
          const field = change?.field;
          const value = change?.value;

          // Most of the time, field = "messages" and value contains { messages, statuses, metadata, contacts }
          // We handle both safely:
          if (value?.messages?.length) {
            await this.handleIncomingMessage(organizationId, value, metaConnection);
          }
          if (value?.statuses?.length) {
            await this.handleMessageStatus(organizationId, value);
          }

          // Some accounts may send template status updates in different fields
          if (field === 'message_template_status_update') {
            await this.handleTemplateStatusUpdate(organizationId, value);
          }

          if (field === 'account_alerts') {
            await this.handleAccountAlert(organizationId, value);
          }
        }

        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: 'SUCCESS',
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      }
    } catch (error: any) {
      console.error('Webhook processing error:', error);

      if (webhookLogId) {
        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: 'FAILED',
            errorMessage: error?.message || 'Unknown error',
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      } else {
        await prisma.webhookLog.create({
          data: {
            source: 'META',
            eventType: 'webhook_error',
            payload,
            status: 'FAILED',
            errorMessage: error?.message || 'Unknown error',
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      }
    }
  }

  /**
   * Handle incoming message(s)
   */
  static async handleIncomingMessage(organizationId: string, value: any, metaConnection: any) {
    const messages = value?.messages;
    const contacts = value?.contacts;
    const metadata = value?.metadata;

    if (!Array.isArray(messages) || messages.length === 0) return;

    for (const m of messages) {
      const wamId = String(m?.id || '');
      const fromRaw = String(m?.from || '');
      const type = String(m?.type || 'text');
      const timestampSec = Number(m?.timestamp || 0);

      if (!wamId || !fromRaw) continue;

      // Dedup: message.wamId is unique in schema
      const exists = await prisma.message.findUnique({ where: { wamId } });
      if (exists) continue;

      // Normalize phone (store digits only in phone, countryCode as "+")
      const from = fromRaw.replace(/[^\d]/g, '');
      const contactName = contacts?.[0]?.profile?.name ? String(contacts[0].profile.name) : from;

      // Find/Create Contact
      let contact = await prisma.contact.findFirst({
        where: { organizationId, phone: from },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId,
            phone: from,
            countryCode: '+',
            firstName: contactName,
            source: 'whatsapp',
          },
        });
      }

      // Pick phoneNumber (best effort)
      const phoneNumberIdFromMeta = metadata?.phone_number_id ? String(metadata.phone_number_id) : undefined;
      const phoneNumber =
        (phoneNumberIdFromMeta
          ? metaConnection.phoneNumbers?.find((p: any) => p.phoneNumberId === phoneNumberIdFromMeta)
          : null) ||
        metaConnection.phoneNumbers?.find((p: any) => p.isPrimary) ||
        metaConnection.phoneNumbers?.[0] ||
        null;

      // Find/Create Conversation (unique: organizationId + contactId)
      let conversation = await prisma.conversation.findFirst({
        where: { organizationId, contactId: contact.id },
        include: { contact: true },
      });

      const isNewConversation = !conversation;

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId,
            contactId: contact.id,
            phoneNumberId: phoneNumber?.id || null,
            isRead: true,
            unreadCount: 0,
          },
          include: { contact: true },
        });
      }

      // Determine message type/content/media
      let msgType: MessageType = 'TEXT';
      let content: string | null = null;
      let mediaUrl: string | null = null;
      let mediaMimeType: string | null = null;

      switch (type) {
        case 'text':
          msgType = 'TEXT';
          content = m?.text?.body ? String(m.text.body) : '';
          break;

        case 'image':
          msgType = 'IMAGE';
          content = m?.image?.caption ? String(m.image.caption) : null;
          mediaUrl = m?.image?.id ? String(m.image.id) : null; // store mediaId for now
          mediaMimeType = m?.image?.mime_type ? String(m.image.mime_type) : null;
          break;

        case 'video':
          msgType = 'VIDEO';
          content = m?.video?.caption ? String(m.video.caption) : null;
          mediaUrl = m?.video?.id ? String(m.video.id) : null;
          mediaMimeType = m?.video?.mime_type ? String(m.video.mime_type) : null;
          break;

        case 'audio':
          msgType = 'AUDIO';
          mediaUrl = m?.audio?.id ? String(m.audio.id) : null;
          mediaMimeType = m?.audio?.mime_type ? String(m.audio.mime_type) : null;
          break;

        case 'document':
          msgType = 'DOCUMENT';
          content = m?.document?.filename ? String(m.document.filename) : null;
          mediaUrl = m?.document?.id ? String(m.document.id) : null;
          mediaMimeType = m?.document?.mime_type ? String(m.document.mime_type) : null;
          break;

        case 'location':
          msgType = 'LOCATION';
          content = m?.location ? JSON.stringify(m.location) : null;
          break;

        case 'contacts':
          msgType = 'CONTACT';
          content = m?.contacts ? JSON.stringify(m.contacts) : null;
          break;

        case 'interactive':
          msgType = 'INTERACTIVE';
          content =
            m?.interactive?.button_reply?.title ||
            m?.interactive?.list_reply?.title ||
            JSON.stringify(m.interactive || {});
          break;

        case 'button':
          msgType = 'TEXT';
          content = m?.button?.text ? String(m.button.text) : '';
          break;

        default:
          msgType = 'TEXT';
          content = `[${type}]`;
      }

      // Map reply context (Meta gives context.id = replied wamId)
      let replyToMessageId: string | null = null;
      const replyWamId = m?.context?.id ? String(m.context.id) : null;
      if (replyWamId) {
        const replyMsg = await prisma.message.findUnique({ where: { wamId: replyWamId } });
        replyToMessageId = replyMsg?.id || null;
      }

      const msgTime = timestampSec ? new Date(timestampSec * 1000) : new Date();

      // Create message
      const newMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          wamId,
          direction: 'INBOUND',
          type: msgType,
          content,
          mediaUrl,
          mediaMimeType,
          status: 'DELIVERED',
          deliveredAt: msgTime,
          replyToMessageId,
          metadata: {
            meta: {
              from: fromRaw,
              phone_number_id: phoneNumberIdFromMeta,
              type,
            },
          },
        },
      });

      // Update conversation (unread + window)
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: msgTime,
          lastMessagePreview: (content || `[${type}]`).substring(0, 100),
          isRead: false,
          unreadCount: { increment: 1 },
          lastCustomerMessageAt: msgTime,
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isWindowOpen: true,
        },
        include: { contact: true },
      });

      // Update contact counters
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: msgTime,
          messageCount: { increment: 1 },
        },
      });

      // 🔌 Emit socket events (keep your naming)
      const formattedMessage = {
        id: newMessage.id,
        wamId: newMessage.wamId,
        conversationId: newMessage.conversationId,
        direction: newMessage.direction,
        type: newMessage.type,
        content: newMessage.content,
        mediaUrl: newMessage.mediaUrl,
        mediaMimeType: newMessage.mediaMimeType,
        status: newMessage.status,
        createdAt: newMessage.createdAt,
      };

      const formattedConversation = {
        id: updatedConversation.id,
        contact: {
          id: updatedConversation.contact.id,
          phone: updatedConversation.contact.phone,
          countryCode: updatedConversation.contact.countryCode,
          firstName: updatedConversation.contact.firstName,
          lastName: updatedConversation.contact.lastName,
          fullName:
            [updatedConversation.contact.firstName, updatedConversation.contact.lastName].filter(Boolean).join(' ') ||
            updatedConversation.contact.phone,
          avatar: updatedConversation.contact.avatar,
          tags: updatedConversation.contact.tags || [],
        },
        lastMessageAt: updatedConversation.lastMessageAt,
        lastMessagePreview: updatedConversation.lastMessagePreview,
        unreadCount: updatedConversation.unreadCount,
        isRead: updatedConversation.isRead,
        isArchived: updatedConversation.isArchived,
        assignedTo: updatedConversation.assignedTo,
        isWindowOpen: updatedConversation.isWindowOpen,
        windowExpiresAt: updatedConversation.windowExpiresAt,
      };

      if (isNewConversation) {
        this.emitSocketEvent('conversation:new', `org:${organizationId}`, { conversation: formattedConversation });
      }

      this.emitSocketEvent('message:new', `org:${organizationId}`, {
        message: formattedMessage,
        conversation: formattedConversation,
      });

      this.emitSocketEvent('message:new', `conversation:${conversation.id}`, { message: formattedMessage });

      this.emitSocketEvent('conversation:updated', `org:${organizationId}`, {
        conversation: formattedConversation,
      });

      // 🤖 Chatbot trigger (safe + schema-compatible)
      // Your schema has Chatbot model, but no chatbotConfig. So we trigger if any ACTIVE chatbot exists.
      try {
        const activeBot = await prisma.chatbot.findFirst({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true },
        });

        if (activeBot && content) {
          const engineMod: any = await import('../chatbot/chatbot.engine');
          const engine = engineMod.chatbotEngine || engineMod.default;

          if (engine?.processMessage) {
            // try to call in a flexible way (avoid TS compile errors)
            await engine.processMessage(conversation.id, organizationId, String(content), fromRaw, isNewConversation);
          }
        }
      } catch (e) {
        // non-blocking
        console.error('Chatbot trigger error:', (e as any)?.message || e);
      }
    }
  }

  /**
   * Handle message status update
   * Meta provides statuses[] with { id, status, timestamp, errors }
   */
  static async handleMessageStatus(organizationId: string, value: any) {
    const statuses = value?.statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) return;

    for (const s of statuses) {
      const wamId = String(s?.id || '');
      const st = String(s?.status || '').toLowerCase();
      const timestampSec = Number(s?.timestamp || 0);

      if (!wamId || !st) continue;

      const message = await prisma.message.findFirst({
        where: { OR: [{ wamId }, { waMessageId: wamId }] },
        select: { id: true, conversationId: true },
      });

      if (!message) continue;

      const t = timestampSec ? new Date(timestampSec * 1000) : new Date();

      const updateData: any = {
        statusUpdatedAt: t,
      };

      if (st === 'sent') {
        updateData.status = 'SENT' as MessageStatus;
        updateData.sentAt = t;
      } else if (st === 'delivered') {
        updateData.status = 'DELIVERED' as MessageStatus;
        updateData.deliveredAt = t;
      } else if (st === 'read') {
        updateData.status = 'READ' as MessageStatus;
        updateData.readAt = t;
      } else if (st === 'failed') {
        updateData.status = 'FAILED' as MessageStatus;
        updateData.failedAt = t;
        updateData.failureReason = s?.errors?.[0]?.title || s?.errors?.[0]?.message || 'Unknown error';
      } else {
        continue;
      }

      await prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // 🔌 emit status update
      this.emitSocketEvent('message:status', `org:${organizationId}`, {
        messageId: message.id,
        conversationId: message.conversationId,
        status: String(updateData.status),
        timestamp: t,
      });

      this.emitSocketEvent('message:status', `conversation:${message.conversationId}`, {
        messageId: message.id,
        status: String(updateData.status),
        timestamp: t,
      });
    }
  }

  /**
   * Handle template status update
   * Your schema supports: PENDING / APPROVED / REJECTED only.
   */
  static async handleTemplateStatusUpdate(organizationId: string, templateData: any) {
    try {
      const event = String(templateData?.event || '').toUpperCase();
      const templateId = String(templateData?.message_template_id || '');
      const reason = templateData?.reason ? String(templateData.reason) : null;

      if (!templateId || !event) return;

      if (event === 'APPROVED') {
        await prisma.template.updateMany({
          where: { organizationId, metaTemplateId: templateId },
          data: { status: 'APPROVED' },
        });

        this.emitSocketEvent('template:approved', `org:${organizationId}`, { templateId });
      }

      if (event === 'REJECTED') {
        await prisma.template.updateMany({
          where: { organizationId, metaTemplateId: templateId },
          data: { status: 'REJECTED', rejectionReason: reason || 'Rejected by Meta' },
        });

        this.emitSocketEvent('template:rejected', `org:${organizationId}`, { templateId, reason });
      }

      // Ignore other events safely (PAUSED etc.)
    } catch (error) {
      console.error('handleTemplateStatusUpdate error:', error);
    }
  }

  /**
   * Handle account alerts
   * Your schema supports: messagingLimit, qualityRating on MetaConnection.
   */
  static async handleAccountAlert(organizationId: string, alertData: any) {
    try {
      if (alertData?.current_limit) {
        await prisma.metaConnection.update({
          where: { organizationId },
          data: { messagingLimit: String(alertData.current_limit) },
        });

        this.emitSocketEvent('account:limitChanged', `org:${organizationId}`, {
          currentLimit: alertData.current_limit,
          previousLimit: alertData.previous_limit,
        });
      }

      if (alertData?.current_quality_rating) {
        await prisma.metaConnection.update({
          where: { organizationId },
          data: { qualityRating: String(alertData.current_quality_rating) },
        });

        this.emitSocketEvent('account:qualityChanged', `org:${organizationId}`, {
          currentRating: alertData.current_quality_rating,
          previousRating: alertData.previous_quality_rating,
        });
      }

      // Log activity (optional)
      await prisma.activityLog.create({
        data: {
          organizationId,
          action: 'ACCOUNT_ALERT',
          entity: 'MetaConnection',
          metadata: alertData,
        },
      });
    } catch (error) {
      console.error('handleAccountAlert error:', error);
    }
  }
}