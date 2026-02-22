// src/modules/webhooks/webhook.service.ts - COMPLETE WITH SOCKET.IO

import prisma from '../../config/database';
import { contactsService } from '../contacts/contacts.service';
import { getIO } from '../../socket';

export class WebhookService {

  /**
   * Emit socket event to organization room
   */
  private emitToOrganization(organizationId: string, event: string, data: any) {
    try {
      const io = getIO();
      if (io) {
        io.to(`org:${organizationId}`).emit(event, data);
        console.log(`📡 [SOCKET] Emitted ${event} to org:${organizationId}`);
      }
    } catch (error) {
      console.error('Socket emit error:', error);
    }
  }

  /**
   * Emit socket event to conversation room
   */
  private emitToConversation(conversationId: string, event: string, data: any) {
    try {
      const io = getIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit(event, data);
        console.log(`📡 [SOCKET] Emitted ${event} to conversation:${conversationId}`);
      }
    } catch (error) {
      console.error('Socket emit error:', error);
    }
  }

  /**
   * Extract WhatsApp profile data from webhook payload
   */
  private extractProfile(payload: any): {
    waId: string;
    profileName: string;
    phone: string;
  } | null {
    try {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages?.[0]) return null;

      const message = value.messages[0];
      const contact = value.contacts?.[0];

      let phone = message.from;
      if (phone.startsWith('91') && phone.length === 12) {
        phone = phone.substring(2);
      }

      return {
        waId: message.from,
        profileName: contact?.profile?.name || 'Unknown',
        phone,
      };
    } catch (error) {
      console.error('Error extracting profile from webhook:', error);
      return null;
    }
  }

  /**
   * Validate if number is Indian
   */
  private isIndianNumber(waId: string): boolean {
    return waId.startsWith('91') && waId.length === 12;
  }

  /**
   * Extract message data from webhook
   */
  private extractMessageData(payload: any): any | null {
    try {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) return null;

      return {
        messages: value.messages || [],
        statuses: value.statuses || [],
        metadata: value.metadata,
      };
    } catch (error) {
      console.error('Error extracting message data:', error);
      return null;
    }
  }

  /**
   * Handle incoming WhatsApp webhook
   */
  async handleWebhook(payload: any): Promise<{
    status: string;
    reason?: string;
    profileName?: string;
    error?: string;
  }> {
    try {
      console.log('📨 Webhook received');

      const profileData = this.extractProfile(payload);

      if (!profileData) {
        console.log('⚠️ No profile data in webhook');
        return { status: 'ignored', reason: 'No profile data' };
      }

      const { waId, profileName, phone } = profileData;

      if (!this.isIndianNumber(waId)) {
        console.log(`⛔ Rejected non-Indian number: ${waId}`);
        return {
          status: 'rejected',
          reason: 'Only Indian numbers (+91) are allowed'
        };
      }

      console.log(`✅ Valid Indian number: ${phone}, Name: ${profileName}`);

      const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        console.error('❌ No phone_number_id in webhook');
        return { status: 'error', reason: 'No phone_number_id' };
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId },
        include: { organization: true },
      });

      if (!account) {
        console.error(`❌ WhatsApp account not found for phone_number_id: ${phoneNumberId}`);
        return { status: 'error', reason: 'Account not found' };
      }

      if (profileName && profileName !== 'Unknown') {
        await contactsService.updateContactFromWebhook(
          phone,
          profileName,
          account.organizationId
        );
        console.log(`✅ Contact updated/created: ${profileName}`);
      }

      const messageData = this.extractMessageData(payload);

      if (messageData) {
        if (messageData.messages.length > 0) {
          for (const message of messageData.messages) {
            await this.processIncomingMessage(message, account);
          }
        }

        if (messageData.statuses.length > 0) {
          for (const status of messageData.statuses) {
            await this.processStatusUpdate(status, account);
          }
        }
      }

      return { status: 'processed', profileName };

    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Process incoming message - WITH SOCKET EMIT
   */
  private async processIncomingMessage(message: any, account: any): Promise<void> {
    try {
      const { from, id: messageId, timestamp, type, text, image, video, document, audio } = message;

      let normalizedPhone = from;
      if (from.startsWith('91') && from.length === 12) {
        normalizedPhone = from.substring(2);
      }

      let contact = await prisma.contact.findFirst({
        where: {
          organizationId: account.organizationId,
          phone: normalizedPhone,
        },
      });

      // Auto-create contact if not found
      if (!contact) {
        console.log(`📝 Creating new contact for: ${normalizedPhone}`);
        contact = await prisma.contact.create({
          data: {
            organizationId: account.organizationId,
            phone: normalizedPhone,
            countryCode: '+91',
            firstName: 'Unknown',
            status: 'ACTIVE',
            source: 'WHATSAPP_INBOUND',
          },
        });
      }

      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId: account.organizationId,
          contactId: contact.id,
        },
      });

      const messageTime = new Date(parseInt(timestamp) * 1000);

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: account.organizationId,
            contactId: contact.id,
            phoneNumberId: account.phoneNumberId,
            lastMessageAt: messageTime,
            isWindowOpen: true,
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        console.log(`💬 Created new conversation: ${conversation.id}`);
      }

      let content: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (type === 'text' && text) {
        content = text.body;
      } else if (type === 'image' && image) {
        mediaUrl = image.id;
        mediaType = 'image';
        content = image.caption || '[Image]';
      } else if (type === 'video' && video) {
        mediaUrl = video.id;
        mediaType = 'video';
        content = video.caption || '[Video]';
      } else if (type === 'document' && document) {
        mediaUrl = document.id;
        mediaType = 'document';
        content = document.filename || '[Document]';
      } else if (type === 'audio' && audio) {
        mediaUrl = audio.id;
        mediaType = 'audio';
        content = '[Audio]';
      } else if (type === 'sticker') {
        content = '[Sticker]';
      } else if (type === 'location') {
        content = '[Location]';
      } else if (type === 'contacts') {
        content = '[Contact]';
      }

      // Save message to database
      const savedMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: account.id,
          waMessageId: messageId,
          wamId: messageId,
          direction: 'INBOUND',
          type: type.toUpperCase(),
          content,
          mediaUrl,
          mediaType,
          status: 'DELIVERED',
          sentAt: messageTime,
          deliveredAt: messageTime,
          createdAt: messageTime,
        },
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: messageTime,
          lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
          lastCustomerMessageAt: messageTime,
          unreadCount: { increment: 1 },
          isRead: false,
          isWindowOpen: true,
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Update contact
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: messageTime,
          messageCount: { increment: 1 },
        },
      });

      console.log(`✅ Incoming message saved: ${messageId}`);

      // ============================================
      // ✅ EMIT SOCKET EVENT FOR REAL-TIME UPDATE
      // ============================================

      const messagePayload = {
        id: savedMessage.id,
        conversationId: conversation.id,
        waMessageId: messageId,
        direction: 'INBOUND',
        type: type.toUpperCase(),
        content,
        mediaUrl,
        mediaType,
        status: 'DELIVERED',
        createdAt: messageTime.toISOString(),
        contact: {
          id: contact.id,
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
      };

      // Emit to organization room
      this.emitToOrganization(account.organizationId, 'message:new', messagePayload);

      // Emit to specific conversation room
      this.emitToConversation(conversation.id, 'message:new', messagePayload);

      // Emit conversation update for inbox list
      const conversationUpdate = {
        id: conversation.id,
        contactId: contact.id,
        lastMessageAt: messageTime.toISOString(),
        lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
        unreadCount: (conversation as any).unreadCount + 1,
        contact: {
          id: contact.id,
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
      };

      this.emitToOrganization(account.organizationId, 'conversation:updated', conversationUpdate);

      console.log(`📡 Real-time events emitted for message: ${messageId}`);

    } catch (error) {
      console.error('Error processing incoming message:', error);
    }
  }

  /**
   * Process status update - WITH SOCKET EMIT
   */
  private async processStatusUpdate(status: any, account: any): Promise<void> {
    try {
      const { id: messageId, status: messageStatus, timestamp } = status;

      const message = await prisma.message.findFirst({
        where: {
          waMessageId: messageId,
          whatsappAccountId: account.id,
        },
        include: {
          conversation: true,
        },
      });

      if (!message) {
        console.log(`Message not found for status update: ${messageId}`);
        return;
      }

      const statusTime = new Date(parseInt(timestamp) * 1000);

      const updateData: any = {
        status: messageStatus.toUpperCase(),
        statusUpdatedAt: statusTime,
      };

      if (messageStatus === 'sent') {
        updateData.sentAt = statusTime;
      } else if (messageStatus === 'delivered') {
        updateData.deliveredAt = statusTime;
      } else if (messageStatus === 'read') {
        updateData.readAt = statusTime;
      } else if (messageStatus === 'failed') {
        updateData.failedAt = statusTime;
        updateData.failureReason = status.errors?.[0]?.message || 'Unknown error';
      }

      await prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      console.log(`✅ Message status updated: ${messageId} → ${messageStatus}`);

      // ✅ EMIT SOCKET EVENT FOR STATUS UPDATE
      const statusPayload = {
        messageId: message.id,
        waMessageId: messageId,
        conversationId: message.conversationId,
        status: messageStatus.toUpperCase(),
        timestamp: statusTime.toISOString(),
      };

      this.emitToOrganization(account.organizationId, 'message:status', statusPayload);
      this.emitToConversation(message.conversationId, 'message:status', statusPayload);

      // Update campaign contact if applicable
      if (message.conversationId) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: message.conversationId },
          include: { contact: true },
        });

        if (conversation) {
          const campaignContact = await prisma.campaignContact.findFirst({
            where: {
              waMessageId: messageId,
              contactId: conversation.contact.id,
            },
          });

          if (campaignContact) {
            await prisma.campaignContact.update({
              where: { id: campaignContact.id },
              data: {
                status: messageStatus.toUpperCase(),
                ...(messageStatus === 'sent' && { sentAt: updateData.sentAt }),
                ...(messageStatus === 'delivered' && { deliveredAt: updateData.deliveredAt }),
                ...(messageStatus === 'read' && { readAt: updateData.readAt }),
                ...(messageStatus === 'failed' && {
                  failedAt: updateData.failedAt,
                  failureReason: updateData.failureReason,
                }),
              },
            });

            const campaign = await prisma.campaign.findUnique({
              where: { id: campaignContact.campaignId },
            });

            if (campaign) {
              const statsUpdate: any = {};

              if (messageStatus === 'delivered') {
                statsUpdate.deliveredCount = { increment: 1 };
              } else if (messageStatus === 'read') {
                statsUpdate.readCount = { increment: 1 };
              }

              if (Object.keys(statsUpdate).length > 0) {
                await prisma.campaign.update({
                  where: { id: campaign.id },
                  data: statsUpdate,
                });
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error processing status update:', error);
    }
  }

  /**
   * Verify webhook (for Meta setup)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ||
      process.env.WEBHOOK_VERIFY_TOKEN ||
      'wabmeta_webhook_verify_2024';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return challenge;
    }

    console.error('❌ Webhook verification failed');
    console.error(`Expected token: ${VERIFY_TOKEN}, Received: ${token}`);
    return null;
  }

  /**
   * Log webhook for debugging
   */
  async logWebhook(payload: any, status: string, error?: string): Promise<void> {
    try {
      const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

      let organizationId: string | null = null;

      if (phoneNumberId) {
        const account = await prisma.whatsAppAccount.findFirst({
          where: { phoneNumberId },
          select: { organizationId: true },
        });
        organizationId = account?.organizationId || null;
      }

      await prisma.webhookLog.create({
        data: {
          organizationId,
          source: 'whatsapp',
          eventType: payload.entry?.[0]?.changes?.[0]?.field || 'unknown',
          payload,
          status: status.toUpperCase() as any,
          processedAt: new Date(),
          errorMessage: error || null,
        },
      });
    } catch (err) {
      console.error('Error logging webhook:', err);
    }
  }
}

export const webhookService = new WebhookService();