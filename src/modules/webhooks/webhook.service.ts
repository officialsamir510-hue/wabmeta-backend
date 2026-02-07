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

      if (!entry || !Array.isArray(entry)) {
        console.log('Invalid webhook payload structure');
        return;
      }

      for (const entryItem of entry) {
        const { id: wabaId, changes } = entryItem;

        if (!changes || !Array.isArray(changes)) {
          continue;
        }

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
    try {
      const { messages, contacts } = messageData;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return;
      }

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
              firstName: contacts?.[0]?.profile?.name || 'Unknown',
              countryCode: from.startsWith('+91') ? '+91' : '+1'
            }
          });
        }

        // Find phone number
        const phoneNumber = await prisma.phoneNumber.findFirst({
          where: {
            metaConnection: { organizationId },
            isActive: true,
            isPrimary: true
          }
        });

        // Find or create conversation
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
            type: type.toUpperCase() as any,
            content: text?.body || '',
            status: 'DELIVERED',
            sentAt: new Date(parseInt(timestamp) * 1000)
          }
        });

        // Update conversation
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: text?.body?.substring(0, 100) || 'Media message',
            unreadCount: { increment: 1 },
            lastCustomerMessageAt: new Date(),
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isWindowOpen: true
          }
        });

        console.log(`✅ Message received for org ${organizationId} from ${from}`);
      }
    } catch (error: any) {
      console.error('Error handling incoming message:', error);
    }
  }

  /**
   * Handle message status update
   */
  static async handleMessageStatus(organizationId: string, statusData: any) {
    try {
      const { statuses } = statusData;

      if (!statuses || !Array.isArray(statuses)) {
        return;
      }

      for (const status of statuses) {
        const { id: wamId, status: messageStatus, timestamp, errors } = status;

        const message = await prisma.message.findUnique({
          where: { wamId }
        });

        if (!message) {
          console.log(`Message not found for wamId: ${wamId}`);
          continue;
        }

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
          updateData.failureReason = errors?.[0]?.message || 'Unknown error';
        }

        await prisma.message.update({
          where: { wamId },
          data: updateData
        });

        console.log(`✅ Message ${wamId} status updated to ${messageStatus}`);
      }
    } catch (error: any) {
      console.error('Error handling message status:', error);
    }
  }

  /**
   * Handle template status update
   */
  static async handleTemplateStatusUpdate(organizationId: string, templateData: any) {
    try {
      console.log('Template status update for org:', organizationId, templateData);
      
      const { message_template_id, message_template_name, message_template_language, event, reason } = templateData;

      if (event === 'APPROVED') {
        // Update template status to approved
        await prisma.template.updateMany({
          where: {
            organizationId,
            metaTemplateId: message_template_id
          },
          data: {
            status: 'APPROVED'
          }
        });
        console.log(`✅ Template ${message_template_name} approved`);
      } else if (event === 'REJECTED') {
        // Update template status to rejected
        await prisma.template.updateMany({
          where: {
            organizationId,
            metaTemplateId: message_template_id
          },
          data: {
            status: 'REJECTED',
            rejectionReason: reason || 'Rejected by Meta'
          }
        });
        console.log(`❌ Template ${message_template_name} rejected: ${reason}`);
      }
    } catch (error: any) {
      console.error('Error handling template status update:', error);
    }
  }

  /**
   * Handle account alerts
   */
  static async handleAccountAlert(organizationId: string, alertData: any) {
    try {
      console.log('Account alert for org:', organizationId, alertData);
      
      // Log the alert
      await prisma.activityLog.create({
        data: {
          organizationId,
          action: 'ACCOUNT_ALERT',
          entity: 'MetaConnection',
          metadata: alertData
        }
      });

      // Handle specific alert types
      if (alertData.current_limit) {
        // Messaging limit changed
        await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            messagingLimit: alertData.current_limit
          }
        });
      }

      if (alertData.current_quality_rating) {
        // Quality rating changed
        await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            qualityRating: alertData.current_quality_rating
          }
        });
      }
    } catch (error: any) {
      console.error('Error handling account alert:', error);
    }
  }
}