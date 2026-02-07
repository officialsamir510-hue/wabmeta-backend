// src/modules/webhooks/webhook.service.ts

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class WebhookService {
  /**
   * Verify webhook signature from Meta
   */
  static verifySignature(signature: string, body: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_APP_SECRET!)
      .update(body)
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Process incoming webhook from Meta
   */
  static async processMetaWebhook(payload: any) {
    try {
      const { entry } = payload;

      for (const entryItem of entry) {
        const { id: wabaId, changes } = entryItem;

        // Find organization by WABA ID
        const metaConnection = await prisma.metaConnection.findFirst({
          where: { wabaId },
          include: {
            organization: true,
            phoneNumbers: true
          }
        });

        if (!metaConnection) {
          console.error('No organization found for WABA:', wabaId);
          continue;
        }

        const organizationId = metaConnection.organizationId;

        // Process changes
        for (const change of changes) {
          const { field, value } = change;

          switch (field) {
            case 'messages':
              await this.handleIncomingMessage(organizationId, value);
              break;

            case 'message_status':
              await this.handleMessageStatus(organizationId, value);
              break;

            case 'message_template_status_update':
              await this.handleTemplateStatusUpdate(organizationId, value);
              break;

            case 'account_alerts':
              await this.handleAccountAlert(organizationId, value);
              break;

            default:
              console.log('Unhandled webhook field:', field);
          }
        }
      }

      // Log webhook
      await prisma.webhookLog.create({
        data: {
          source: 'META',
          eventType: 'webhook_received',
          payload,
          status: 'SUCCESS'
        }
      });

    } catch (error: any) {
      console.error('Webhook processing error:', error);
      
      // Log error
      await prisma.webhookLog.create({
        data: {
          source: 'META',
          eventType: 'webhook_error',
          payload,
          status: 'FAILED',
          errorMessage: error.message
        }
      });
    }
  }

  /**
   * Handle incoming message for specific organization
   */
  static async handleIncomingMessage(organizationId: string, messageData: any) {
    const { messages, contacts } = messageData;

    for (const message of messages) {
      const { id: wamId, from, type, text, timestamp } = message;

      // Find or create contact
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId,
          phone: from
        }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId,
            phone: from,
            firstName: contacts?.[0]?.profile?.name || 'Unknown'
          }
        });
      }

      // Find or create conversation
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: {
          metaConnection: { organizationId }
        }
      });

      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId,
          contactId: contact.id
        }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId,
            contactId: contact.id,
            phoneNumberId: phoneNumber?.id
          }
        });
      }

      // Create message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          wamId,
          direction: 'INBOUND',
          type: type.toUpperCase(),
          text: text?.body,
          status: 'DELIVERED',
          sentAt: new Date(parseInt(timestamp) * 1000)
        }
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
          lastCustomerMessageAt: new Date(),
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      console.log(`✅ Message received for org ${organizationId} from ${from}`);
    }
  }

  /**
   * Handle message status update
   */
  static async handleMessageStatus(organizationId: string, statusData: any) {
    const { statuses } = statusData;

    for (const status of statuses) {
      const { id: wamId, status: messageStatus, timestamp } = status;

      const message = await prisma.message.findUnique({
        where: { wamId }
      });

      if (message) {
        const updateData: any = {
          status: messageStatus.toUpperCase(),
          statusUpdatedAt: new Date(parseInt(timestamp) * 1000)
        };

        if (messageStatus === 'delivered') {
          updateData.deliveredAt = new Date(parseInt(timestamp) * 1000);
        } else if (messageStatus === 'read') {
          updateData.readAt = new Date(parseInt(timestamp) * 1000);
        } else if (messageStatus === 'failed') {
          updateData.failedAt = new Date(parseInt(timestamp) * 1000);
        }

        await prisma.message.update({
          where: { wamId },
          data: updateData
        });

        console.log(`✅ Message ${wamId} status updated to ${messageStatus}`);
      }
    }
  }

  /**
   * Handle template status update
   */
  static async handleTemplateStatusUpdate(organizationId: string, templateData: any) {
    console.log('Template status update for org:', organizationId, templateData);
    // Implement template status update logic
  }

  /**
   * Handle account alerts
   */
  static async handleAccountAlert(organizationId: string, alertData: any) {
    console.log('Account alert for org:', organizationId, alertData);
    // Implement alert handling logic
  }
}