// src/modules/webhooks/webhook.service.ts

import { PrismaClient, MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class WebhookService {
  /**
   * Verify webhook signature from Meta
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
      if (io) {
        io.to(room).emit(event, data);
        console.log(`📡 Emitted ${event} to room ${room}`);
      } else {
        console.warn('⚠️ Socket.IO not initialized');
      }
    } catch (error) {
      console.error('Error emitting socket event:', error);
    }
  }

  /**
   * Process incoming webhook from Meta
   */
  static async processMetaWebhook(payload: any) {
    const startTime = Date.now();
    let webhookLog;

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
            phoneNumbers: true,
          },
        });

        if (!metaConnection) {
          console.error('No organization found for WABA:', wabaId);
          continue;
        }

        const organizationId = metaConnection.organizationId;

        // Create webhook log
        webhookLog = await prisma.webhookLog.create({
          data: {
            organizationId,
            source: 'META',
            eventType: 'messages',
            payload,
            status: 'PROCESSING',
          },
        });

        // Process changes
        for (const change of changes) {
          const { field, value } = change;

          switch (field) {
            case 'messages':
              await this.handleIncomingMessage(organizationId, value, metaConnection);
              break;

            case 'message_status':
            case 'statuses':
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

        // Update webhook log
        await prisma.webhookLog.update({
          where: { id: webhookLog.id },
          data: {
            status: 'SUCCESS',
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      }
    } catch (error: any) {
      console.error('Webhook processing error:', error);

      // Update webhook log with error
      if (webhookLog) {
        await prisma.webhookLog.update({
          where: { id: webhookLog.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      } else {
        // Create error log
        await prisma.webhookLog.create({
          data: {
            source: 'META',
            eventType: 'webhook_error',
            payload,
            status: 'FAILED',
            errorMessage: error.message,
            processedAt: new Date(),
            responseTime: Date.now() - startTime,
          },
        });
      }
    }
  }

  /**
   * Handle incoming message
   */
  static async handleIncomingMessage(
    organizationId: string,
    messageData: any,
    metaConnection: any
  ) {
    try {
      const { messages, contacts, metadata } = messageData;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return;
      }

      for (const message of messages) {
        const { id: wamId, from, type, text, image, video, audio, document, timestamp, context } = message;

        // Check if message already exists (prevent duplicates)
        const existingMessage = await prisma.message.findUnique({
          where: { wamId },
        });

        if (existingMessage) {
          console.log(`Message ${wamId} already exists, skipping`);
          continue;
        }

        // Find or create contact
        let contact = await prisma.contact.findFirst({
          where: {
            organizationId,
            phone: from,
          },
        });

        const contactName = contacts?.[0]?.profile?.name || from;

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              organizationId,
              phone: from,
              firstName: contactName,
              countryCode: from.startsWith('91') ? '+91' : '+1',
              source: 'whatsapp',
            },
          });
        }

        // Find primary phone number
        const phoneNumber = metaConnection.phoneNumbers.find((p: any) => p.isPrimary) ||
                           metaConnection.phoneNumbers[0];

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: {
            organizationId,
            contactId: contact.id,
          },
          include: {
            contact: true,
            assignedTo: true,
          },
        });

        const isNewConversation = !conversation;
        const isReturningCustomer = conversation && 
          conversation.lastMessageAt && 
          (Date.now() - new Date(conversation.lastMessageAt).getTime() > 24 * 60 * 60 * 1000);

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              organizationId,
              contactId: contact.id,
              phoneNumberId: phoneNumber?.id,
              status: 'OPEN',
            },
            include: {
              contact: true,
              assignedTo: true,
            },
          });
        }

        // Determine message type and content
        let messageType: MessageType = 'TEXT';
        let content = '';
        let mediaUrl = '';
        let mediaMimeType = '';

        switch (type) {
          case 'text':
            messageType = 'TEXT';
            content = text?.body || '';
            break;
          case 'image':
            messageType = 'IMAGE';
            content = image?.caption || '';
            mediaUrl = image?.id || '';
            mediaMimeType = image?.mime_type || '';
            break;
          case 'video':
            messageType = 'VIDEO';
            content = video?.caption || '';
            mediaUrl = video?.id || '';
            mediaMimeType = video?.mime_type || '';
            break;
          case 'audio':
            messageType = 'AUDIO';
            mediaUrl = audio?.id || '';
            mediaMimeType = audio?.mime_type || '';
            break;
          case 'document':
            messageType = 'DOCUMENT';
            content = document?.filename || '';
            mediaUrl = document?.id || '';
            mediaMimeType = document?.mime_type || '';
            break;
          case 'location':
            messageType = 'LOCATION';
            content = JSON.stringify(message.location);
            break;
          case 'button':
            messageType = 'TEXT';
            content = message.button?.text || '';
            break;
          case 'interactive':
            messageType = 'TEXT';
            if (message.interactive?.type === 'button_reply') {
              content = message.interactive.button_reply?.title || '';
            } else if (message.interactive?.type === 'list_reply') {
              content = message.interactive.list_reply?.title || '';
            }
            break;
          default:
            messageType = 'TEXT';
            content = `[${type}]`;
        }

        // Create message
        const newMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            wamId,
            direction: 'INBOUND',
            type: messageType,
            content,
            mediaUrl: mediaUrl || null,
            mediaMimeType: mediaMimeType || null,
            status: 'DELIVERED',
            sentAt: new Date(parseInt(timestamp) * 1000),
            replyToMessageId: context?.id || null, // Handle reply context
          },
        });

        // Update conversation
        const updatedConversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: content.substring(0, 100) || `[${type}]`,
            unreadCount: { increment: 1 },
            isRead: false,
            lastCustomerMessageAt: new Date(),
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            isWindowOpen: true,
            status: 'OPEN',
            messageCount: { increment: 1 },
          },
          include: {
            contact: true,
            assignedTo: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        // Update contact
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            lastMessageAt: new Date(),
            messageCount: { increment: 1 },
          },
        });

        console.log(`✅ Message received from ${from} in org ${organizationId}`);

        // ========================================
        // 🤖 TRIGGER CHATBOT
        // ========================================
        try {
          // Check if chatbot is enabled for this organization
          const chatbotConfig = await prisma.chatbotConfig.findFirst({
            where: {
              organizationId,
              isActive: true,
            },
          });

          if (chatbotConfig) {
            console.log(`🤖 Triggering chatbot for conversation ${conversation.id}`);
            
            // Dynamic import to avoid circular dependencies
            const { ChatbotEngine } = await import('../chatbot/chatbot.engine');
            
            // Initialize chatbot engine
            const chatbotEngine = new ChatbotEngine(organizationId);
            
            // Process the message through chatbot
            await chatbotEngine.processMessage({
              conversationId: conversation.id,
              organizationId,
              message: content || '',
              senderPhone: from,
              isNewConversation: isNewConversation || isReturningCustomer,
              messageType,
              contactName: contact.firstName || from,
              metadata: {
                wamId,
                timestamp: new Date(parseInt(timestamp) * 1000),
                phoneNumberId: phoneNumber?.id,
              },
            });
            
            console.log(`✅ Chatbot processed message for conversation ${conversation.id}`);
          } else {
            console.log(`🤖 Chatbot not enabled for organization ${organizationId}`);
          }
        } catch (chatbotError: any) {
          console.error('❌ Chatbot processing error:', chatbotError);
          // Don't throw - chatbot errors shouldn't break message handling
          
          // Log chatbot error for debugging
          await prisma.activityLog.create({
            data: {
              organizationId,
              action: 'CHATBOT_ERROR',
              entity: 'Message',
              entityId: newMessage.id,
              metadata: {
                error: chatbotError.message,
                conversationId: conversation.id,
                messageContent: content.substring(0, 100),
              },
            },
          });
        }

        // ========================================
        // 🔌 EMIT SOCKET EVENTS
        // ========================================
        
        // Format message for frontend
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
          sentAt: newMessage.sentAt,
          createdAt: newMessage.createdAt,
        };

        // Format conversation for frontend
        const formattedConversation = {
          id: updatedConversation.id,
          contact: {
            id: updatedConversation.contact.id,
            phone: updatedConversation.contact.phone,
            firstName: updatedConversation.contact.firstName,
            lastName: updatedConversation.contact.lastName,
            fullName: [updatedConversation.contact.firstName, updatedConversation.contact.lastName]
              .filter(Boolean)
              .join(' ') || updatedConversation.contact.phone,
            avatar: updatedConversation.contact.avatar,
          },
          lastMessageAt: updatedConversation.lastMessageAt,
          lastMessagePreview: updatedConversation.lastMessagePreview,
          unreadCount: updatedConversation.unreadCount,
          isRead: updatedConversation.isRead,
          status: updatedConversation.status,
          assignedTo: updatedConversation.assignedTo,
        };

        // Emit events
        if (isNewConversation) {
          this.emitSocketEvent('conversation:new', `org:${organizationId}`, {
            conversation: formattedConversation,
          });
        }

        this.emitSocketEvent('message:new', `org:${organizationId}`, {
          message: formattedMessage,
          conversation: formattedConversation,
        });

        // Emit to conversation-specific room
        this.emitSocketEvent('message:new', `conversation:${conversation.id}`, {
          message: formattedMessage,
        });

        this.emitSocketEvent('conversation:updated', `org:${organizationId}`, {
          conversation: formattedConversation,
        });
      }
    } catch (error: any) {
      console.error('Error handling incoming message:', error);
      throw error;
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
        const { id: wamId, status: messageStatus, timestamp, errors, recipient_id } = status;

        // Find message by wamId or waMessageId
        const message = await prisma.message.findFirst({
          where: {
            OR: [
              { wamId },
              { waMessageId: wamId },
            ],
          },
          include: {
            conversation: true,
          },
        });

        if (!message) {
          console.log(`Message not found for wamId: ${wamId}`);
          continue;
        }

        const updateData: any = {
          status: messageStatus.toUpperCase() as MessageStatus,
          statusUpdatedAt: new Date(parseInt(timestamp) * 1000),
        };

        if (messageStatus === 'sent') {
          updateData.sentAt = new Date(parseInt(timestamp) * 1000);
        } else if (messageStatus === 'delivered') {
          updateData.deliveredAt = new Date(parseInt(timestamp) * 1000);
        } else if (messageStatus === 'read') {
          updateData.readAt = new Date(parseInt(timestamp) * 1000);
          
          // Mark conversation as read by customer
          await prisma.conversation.update({
            where: { id: message.conversationId },
            data: {
              lastReadByCustomerAt: new Date(parseInt(timestamp) * 1000),
            },
          });
        } else if (messageStatus === 'failed') {
          updateData.failedAt = new Date(parseInt(timestamp) * 1000);
          updateData.failureReason = errors?.[0]?.message || errors?.[0]?.title || 'Unknown error';
          
          // Log failed message for debugging
          await prisma.activityLog.create({
            data: {
              organizationId,
              action: 'MESSAGE_FAILED',
              entity: 'Message',
              entityId: message.id,
              metadata: {
                wamId,
                recipient: recipient_id,
                error: errors?.[0],
              },
            },
          });
        }

        const updatedMessage = await prisma.message.update({
          where: { id: message.id },
          data: updateData,
        });

        console.log(`✅ Message ${wamId} status updated to ${messageStatus}`);

        // ========================================
        // 🔌 EMIT SOCKET EVENT
        // ========================================
        
        this.emitSocketEvent('message:status', `org:${organizationId}`, {
          messageId: message.id,
          conversationId: message.conversationId,
          status: messageStatus.toUpperCase(),
          timestamp: new Date(parseInt(timestamp) * 1000),
        });

        // Emit to conversation-specific room
        this.emitSocketEvent('message:status', `conversation:${message.conversationId}`, {
          messageId: message.id,
          status: messageStatus.toUpperCase(),
          timestamp: new Date(parseInt(timestamp) * 1000),
        });
      }
    } catch (error: any) {
      console.error('Error handling message status:', error);
      throw error;
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
        await prisma.template.updateMany({
          where: {
            organizationId,
            metaTemplateId: message_template_id,
          },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
          },
        });

        // Emit socket event
        this.emitSocketEvent('template:approved', `org:${organizationId}`, {
          templateId: message_template_id,
          templateName: message_template_name,
          language: message_template_language,
        });

        // Log approval
        await prisma.activityLog.create({
          data: {
            organizationId,
            action: 'TEMPLATE_APPROVED',
            entity: 'Template',
            entityId: message_template_id,
            metadata: {
              name: message_template_name,
              language: message_template_language,
            },
          },
        });

        console.log(`✅ Template ${message_template_name} approved`);
      } else if (event === 'REJECTED') {
        await prisma.template.updateMany({
          where: {
            organizationId,
            metaTemplateId: message_template_id,
          },
          data: {
            status: 'REJECTED',
            rejectionReason: reason || 'Rejected by Meta',
          },
        });

        // Emit socket event
        this.emitSocketEvent('template:rejected', `org:${organizationId}`, {
          templateId: message_template_id,
          templateName: message_template_name,
          reason: reason || 'Rejected by Meta',
        });

        // Log rejection
        await prisma.activityLog.create({
          data: {
            organizationId,
            action: 'TEMPLATE_REJECTED',
            entity: 'Template',
            entityId: message_template_id,
            metadata: {
              name: message_template_name,
              reason: reason || 'Rejected by Meta',
            },
          },
        });

        console.log(`❌ Template ${message_template_name} rejected: ${reason}`);
      } else if (event === 'PAUSED') {
        await prisma.template.updateMany({
          where: {
            organizationId,
            metaTemplateId: message_template_id,
          },
          data: {
            status: 'PAUSED',
            pausedReason: reason,
          },
        });

        // Emit socket event
        this.emitSocketEvent('template:paused', `org:${organizationId}`, {
          templateId: message_template_id,
          templateName: message_template_name,
          reason: reason,
        });

        console.log(`⏸️ Template ${message_template_name} paused: ${reason}`);
      }
    } catch (error: any) {
      console.error('Error handling template status update:', error);
      throw error;
    }
  }

  /**
   * Handle account alerts
   */
  static async handleAccountAlert(organizationId: string, alertData: any) {
    try {
      console.log('Account alert for org:', organizationId, alertData);

      await prisma.activityLog.create({
        data: {
          organizationId,
          action: 'ACCOUNT_ALERT',
          entity: 'MetaConnection',
          metadata: alertData,
        },
      });

      if (alertData.current_limit) {
        await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            messagingLimit: alertData.current_limit,
          },
        });

        // Emit socket event
        this.emitSocketEvent('account:limitChanged', `org:${organizationId}`, {
          currentLimit: alertData.current_limit,
          previousLimit: alertData.previous_limit,
        });

        console.log(`📊 Messaging limit changed: ${alertData.previous_limit} → ${alertData.current_limit}`);
      }

      if (alertData.current_quality_rating) {
        await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            qualityRating: alertData.current_quality_rating,
          },
        });

        // Emit socket event
        this.emitSocketEvent('account:qualityChanged', `org:${organizationId}`, {
          currentRating: alertData.current_quality_rating,
          previousRating: alertData.previous_quality_rating,
        });

        console.log(`⭐ Quality rating changed: ${alertData.previous_quality_rating} → ${alertData.current_quality_rating}`);
      }

      if (alertData.restriction_info) {
        // Handle account restrictions
        await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            isRestricted: true,
            restrictionReason: alertData.restriction_info.reason,
          },
        });

        // Emit socket event
        this.emitSocketEvent('account:restricted', `org:${organizationId}`, {
          reason: alertData.restriction_info.reason,
          details: alertData.restriction_info,
        });

        console.log(`⚠️ Account restricted: ${alertData.restriction_info.reason}`);
      }
    } catch (error: any) {
      console.error('Error handling account alert:', error);
      throw error;
    }
  }
}