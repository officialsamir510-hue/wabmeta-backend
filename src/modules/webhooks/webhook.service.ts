// src/modules/webhooks/webhook.service.ts

import prisma from '../../config/database';
import { contactsService } from '../contacts/contacts.service';

export class WebhookService {

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

      // Extract 10-digit phone from waId (format: 919876543210)
      let phone = message.from;
      if (phone.startsWith('91') && phone.length === 12) {
        phone = phone.substring(2); // Remove country code
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
    // waId format: 919876543210 (12 digits starting with 91)
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

      // Extract profile data
      const profileData = this.extractProfile(payload);

      if (!profileData) {
        console.log('⚠️ No profile data in webhook');
        return { status: 'ignored', reason: 'No profile data' };
      }

      const { waId, profileName, phone } = profileData;

      // Validate Indian number only
      if (!this.isIndianNumber(waId)) {
        console.log(`⛔ Rejected non-Indian number: ${waId}`);
        return {
          status: 'rejected',
          reason: 'Only Indian numbers (+91) are allowed'
        };
      }

      console.log(`✅ Valid Indian number: ${phone}, Name: ${profileName}`);

      // Find WhatsApp account by phone number ID
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

      // Update or create contact with REAL WhatsApp name
      if (profileName && profileName !== 'Unknown') {
        await contactsService.updateContactFromWebhook(
          phone,
          profileName,
          account.organizationId
        );
        console.log(`✅ Contact updated/created: ${profileName}`);
      }

      // Process message
      const messageData = this.extractMessageData(payload);

      if (messageData) {
        // Handle incoming messages
        if (messageData.messages.length > 0) {
          for (const message of messageData.messages) {
            await this.processIncomingMessage(message, account);
          }
        }

        // Handle status updates (sent, delivered, read)
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
   * Process incoming message
   */
  private async processIncomingMessage(message: any, account: any): Promise<void> {
    try {
      const { from, id: messageId, timestamp, type, text, image, video, document, audio } = message;

      // Normalize phone (remove country code)
      let normalizedPhone = from;
      if (from.startsWith('91') && from.length === 12) {
        normalizedPhone = from.substring(2);
      }

      // Find contact
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId: account.organizationId,
          phone: normalizedPhone,
        },
      });

      if (!contact) {
        console.log(`Contact not found for incoming message: ${normalizedPhone}`);
        return;
      }

      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId: account.organizationId,
          contactId: contact.id,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: account.organizationId,
            contactId: contact.id,
            phoneNumberId: account.phoneNumberId,
            lastMessageAt: new Date(parseInt(timestamp) * 1000),
            isWindowOpen: true,
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });
      }

      // Determine message content
      let content = null;
      let mediaUrl = null;

      if (type === 'text' && text) {
        content = text.body;
      } else if (type === 'image' && image) {
        mediaUrl = image.id;
        content = image.caption || '[Image]';
      } else if (type === 'video' && video) {
        mediaUrl = video.id;
        content = video.caption || '[Video]';
      } else if (type === 'document' && document) {
        mediaUrl = document.id;
        content = document.filename || '[Document]';
      } else if (type === 'audio' && audio) {
        mediaUrl = audio.id;
        content = '[Audio]';
      }

      // Save message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: account.id,
          waMessageId: messageId,
          wamId: messageId,
          direction: 'INBOUND',
          type: type.toUpperCase(),
          content,
          mediaUrl,
          status: 'DELIVERED',
          sentAt: new Date(parseInt(timestamp) * 1000),
          deliveredAt: new Date(parseInt(timestamp) * 1000),
          createdAt: new Date(parseInt(timestamp) * 1000),
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(parseInt(timestamp) * 1000),
          lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
          lastCustomerMessageAt: new Date(parseInt(timestamp) * 1000),
          unreadCount: { increment: 1 },
          isRead: false,
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Update contact message count
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: new Date(parseInt(timestamp) * 1000),
          messageCount: { increment: 1 },
        },
      });

      console.log(`✅ Incoming message saved: ${messageId}`);

    } catch (error) {
      console.error('Error processing incoming message:', error);
    }
  }

  /**
   * Process status update
   */
  private async processStatusUpdate(status: any, account: any): Promise<void> {
    try {
      const { id: messageId, status: messageStatus, timestamp } = status;

      const message = await prisma.message.findFirst({
        where: {
          waMessageId: messageId,
          whatsappAccountId: account.id,
        },
      });

      if (!message) {
        console.log(`Message not found for status update: ${messageId}`);
        return;
      }

      const updateData: any = {
        status: messageStatus.toUpperCase(),
        statusUpdatedAt: new Date(parseInt(timestamp) * 1000),
      };

      if (messageStatus === 'sent') {
        updateData.sentAt = new Date(parseInt(timestamp) * 1000);
      } else if (messageStatus === 'delivered') {
        updateData.deliveredAt = new Date(parseInt(timestamp) * 1000);
      } else if (messageStatus === 'read') {
        updateData.readAt = new Date(parseInt(timestamp) * 1000);
      } else if (messageStatus === 'failed') {
        updateData.failedAt = new Date(parseInt(timestamp) * 1000);
        updateData.failureReason = status.errors?.[0]?.message || 'Unknown error';
      }

      await prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // Update campaign contact status if applicable
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

            // Update campaign stats
            const campaign = await prisma.campaign.findUnique({
              where: { id: campaignContact.campaignId },
            });

            if (campaign) {
              const statsUpdate: any = {};

              if (messageStatus === 'sent') {
                statsUpdate.sentCount = { increment: 1 };
              } else if (messageStatus === 'delivered') {
                statsUpdate.deliveredCount = { increment: 1 };
              } else if (messageStatus === 'read') {
                statsUpdate.readCount = { increment: 1 };
              } else if (messageStatus === 'failed') {
                statsUpdate.failedCount = { increment: 1 };
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

      console.log(`✅ Message status updated: ${messageId} → ${messageStatus}`);

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
      'wabmeta_webhook_token';

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