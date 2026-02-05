// src/modules/whatsapp/whatsapp.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { MessageStatus, MessageType, MessageDirection, Prisma } from '@prisma/client';
import { MetaApiClient } from './whatsapp.api';
import {
  WhatsAppAccountResponse,
  SendMessageResponse,
  WebhookPayload,
  WebhookMessage,
  WebhookStatus,
  ProcessedMessage,
  TemplateComponent,
} from './whatsapp.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatWhatsAppAccount = (account: any): WhatsAppAccountResponse => ({
  id: account.id,
  phoneNumberId: account.phoneNumberId,
  wabaId: account.wabaId,
  phoneNumber: account.phoneNumber,
  displayName: account.displayName,
  qualityRating: account.qualityRating,
  status: account.status,
  isDefault: account.isDefault,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

const mapWebhookMessageType = (type: string): MessageType => {
  const typeMap: Record<string, MessageType> = {
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
  return typeMap[type] || 'TEXT';
};

const extractMessageContent = (message: WebhookMessage): { content: string | null; mediaUrl: string | null; mediaType: string | null; mediaMimeType: string | null } => {
  let content: string | null = null;
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  let mediaMimeType: string | null = null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || null;
      break;
    case 'image':
      mediaType = 'image';
      mediaMimeType = message.image?.mime_type || null;
      content = message.image?.caption || null;
      break;
    case 'video':
      mediaType = 'video';
      mediaMimeType = message.video?.mime_type || null;
      content = message.video?.caption || null;
      break;
    case 'audio':
      mediaType = 'audio';
      mediaMimeType = message.audio?.mime_type || null;
      break;
    case 'document':
      mediaType = 'document';
      mediaMimeType = message.document?.mime_type || null;
      content = message.document?.caption || message.document?.filename || null;
      break;
    case 'sticker':
      mediaType = 'sticker';
      mediaMimeType = message.sticker?.mime_type || null;
      break;
    case 'location':
      content = message.location ? `${message.location.latitude},${message.location.longitude}` : null;
      break;
    case 'button':
      content = message.button?.text || null;
      break;
    case 'interactive':
      if (message.interactive?.button_reply) {
        content = message.interactive.button_reply.title;
      } else if (message.interactive?.list_reply) {
        content = message.interactive.list_reply.title;
      }
      break;
  }

  return { content, mediaUrl, mediaType, mediaMimeType };
};

// ============================================
// WHATSAPP SERVICE CLASS
// ============================================

export class WhatsAppService {
  // ==========================================
  // CONNECT ACCOUNT
  // ==========================================
  async connectAccount(
    organizationId: string,
    code: string,
    redirectUri: string
  ): Promise<WhatsAppAccountResponse> {
    try {
      // Exchange code for access token
      const tokenResponse = await MetaApiClient.exchangeCodeForToken(code, redirectUri);
      
      // Get long-lived token
      const longLivedToken = await MetaApiClient.getLongLivedToken(tokenResponse.access_token);

      // Create API client
      const client = new MetaApiClient(longLivedToken.access_token, '', '');

      // Get WhatsApp Business Accounts
      const wabaList = await client.getWhatsAppBusinessAccounts();
      
      if (wabaList.length === 0) {
        throw new AppError('No WhatsApp Business Account found', 400);
      }

      const waba = wabaList[0];

      // Get phone numbers for the WABA
      const phoneNumbers = await client.getPhoneNumbers(waba.id);

      if (phoneNumbers.length === 0) {
        throw new AppError('No phone numbers found in WhatsApp Business Account', 400);
      }

      const phoneNumber = phoneNumbers[0];

      // Check if account already connected
      const existing = await prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId: phoneNumber.id },
      });

      if (existing) {
        // Update existing account
        const updated = await prisma.whatsAppAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: longLivedToken.access_token,
            status: 'CONNECTED',
            displayName: phoneNumber.verified_name,
            qualityRating: phoneNumber.quality_rating,
          },
        });
        return formatWhatsAppAccount(updated);
      }

      // Check if org has any accounts (for default setting)
      const existingAccountsCount = await prisma.whatsAppAccount.count({
        where: { organizationId },
      });

      // Create new account
      const account = await prisma.whatsAppAccount.create({
        data: {
          organizationId,
          phoneNumberId: phoneNumber.id,
          wabaId: waba.id,
          phoneNumber: phoneNumber.display_phone_number,
          displayName: phoneNumber.verified_name,
          qualityRating: phoneNumber.quality_rating,
          accessToken: longLivedToken.access_token,
          status: 'CONNECTED',
          isDefault: existingAccountsCount === 0,
        },
      });

      return formatWhatsAppAccount(account);
    } catch (error: any) {
      console.error('WhatsApp connect error:', error);
      throw new AppError(error.message || 'Failed to connect WhatsApp account', 400);
    }
  }

  // ==========================================
  // DISCONNECT ACCOUNT
  // ==========================================
  async disconnectAccount(
    organizationId: string,
    accountId: string
  ): Promise<{ message: string }> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        status: 'DISCONNECTED',
        accessToken: '',
      },
    });

    return { message: 'WhatsApp account disconnected successfully' };
  }

  // ==========================================
  // GET ACCOUNTS
  // ==========================================
  async getAccounts(organizationId: string): Promise<WhatsAppAccountResponse[]> {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map(formatWhatsAppAccount);
  }

  // ==========================================
  // GET ACCOUNT BY ID
  // ==========================================
  async getAccountById(
    organizationId: string,
    accountId: string
  ): Promise<WhatsAppAccountResponse> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    return formatWhatsAppAccount(account);
  }

  // ==========================================
  // SET DEFAULT ACCOUNT
  // ==========================================
  async setDefaultAccount(
    organizationId: string,
    accountId: string
  ): Promise<WhatsAppAccountResponse> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    // Remove default from all other accounts
    await prisma.whatsAppAccount.updateMany({
      where: {
        organizationId,
        id: { not: accountId },
      },
      data: { isDefault: false },
    });

    // Set this account as default
    const updated = await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });

    return formatWhatsAppAccount(updated);
  }

  // ==========================================
  // SEND TEXT MESSAGE
  // ==========================================
  async sendTextMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    text: string,
    replyToMessageId?: string
  ): Promise<SendMessageResponse> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
    
    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    try {
      const response = await client.sendTextMessage(to, text, false, replyToMessageId);

      // Save message to database
      await this.saveOutboundMessage(
        organizationId,
        account.id,
        to,
        'TEXT',
        text,
        response.messages[0].id,
        replyToMessageId
      );

      return {
        success: true,
        messageId: response.messages[0].id,
        waId: response.contacts[0].wa_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }
  }

  // ==========================================
  // SEND TEMPLATE MESSAGE
  // ==========================================
  async sendTemplateMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[]
  ): Promise<SendMessageResponse> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    try {
      const response = await client.sendTemplateMessage(to, templateName, languageCode, components);

      // Save message to database
      await this.saveOutboundMessage(
        organizationId,
        account.id,
        to,
        'TEMPLATE',
        null,
        response.messages[0].id,
        undefined,
        { templateName, languageCode, components }
      );

      return {
        success: true,
        messageId: response.messages[0].id,
        waId: response.contacts[0].wa_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send template message',
      };
    }
  }

  // ==========================================
  // SEND MEDIA MESSAGE
  // ==========================================
  async sendMediaMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    type: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string,
    filename?: string
  ): Promise<SendMessageResponse> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    try {
      let response;

      switch (type) {
        case 'image':
          response = await client.sendImageMessage(to, mediaUrl, caption);
          break;
        case 'video':
          response = await client.sendVideoMessage(to, mediaUrl, caption);
          break;
        case 'document':
          response = await client.sendDocumentMessage(to, mediaUrl, filename || 'document', caption);
          break;
        case 'audio':
          response = await client.sendMessage({
            to,
            type: 'audio',
            audio: { link: mediaUrl },
          });
          break;
      }

      if (!response) {
        throw new Error('Failed to send media message');
      }

      // Save message to database
      const messageType = type.toUpperCase() as MessageType;
      await this.saveOutboundMessage(
        organizationId,
        account.id,
        to,
        messageType,
        caption || null,
        response.messages[0].id,
        undefined,
        { mediaUrl, filename }
      );

      return {
        success: true,
        messageId: response.messages[0].id,
        waId: response.contacts[0].wa_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send media message',
      };
    }
  }

  // ==========================================
  // SEND INTERACTIVE MESSAGE
  // ==========================================
  async sendInteractiveMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    interactiveType: 'button' | 'list',
    bodyText: string,
    options: {
      headerText?: string;
      footerText?: string;
      buttons?: { id: string; title: string }[];
      buttonText?: string;
      sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
    }
  ): Promise<SendMessageResponse> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    try {
      let response;

      if (interactiveType === 'button' && options.buttons) {
        response = await client.sendButtonMessage(
          to,
          bodyText,
          options.buttons,
          options.headerText,
          options.footerText
        );
      } else if (interactiveType === 'list' && options.sections && options.buttonText) {
        response = await client.sendListMessage(
          to,
          bodyText,
          options.buttonText,
          options.sections,
          options.headerText,
          options.footerText
        );
      } else {
        throw new Error('Invalid interactive message configuration');
      }

      // Save message to database
      await this.saveOutboundMessage(
        organizationId,
        account.id,
        to,
        'INTERACTIVE',
        bodyText,
        response.messages[0].id
      );

      return {
        success: true,
        messageId: response.messages[0].id,
        waId: response.contacts[0].wa_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send interactive message',
      };
    }
  }

  // ==========================================
  // PROCESS WEBHOOK
  // ==========================================
  async processWebhook(payload: WebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        // Find WhatsApp account
        const account = await prisma.whatsAppAccount.findUnique({
          where: { phoneNumberId },
          include: { organization: true },
        });

        if (!account) {
          console.log(`WhatsApp account not found for phone number ID: ${phoneNumberId}`);
          continue;
        }

        // Process incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await this.processIncomingMessage(account, message, value.contacts?.[0]);
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.processStatusUpdate(status);
          }
        }
      }
    }
  }

  // ==========================================
  // PROCESS INCOMING MESSAGE
  // ==========================================
  private async processIncomingMessage(
    account: any,
    message: WebhookMessage,
    contact?: { profile: { name: string }; wa_id: string }
  ): Promise<void> {
    const fromPhone = message.from;
    const fromName = contact?.profile?.name || fromPhone;
    const organizationId = account.organizationId;

    // Find or create contact
    let dbContact = await prisma.contact.findFirst({
      where: {
        organizationId,
        phone: fromPhone,
      },
    });

    if (!dbContact) {
      // Create new contact
      dbContact = await prisma.contact.create({
        data: {
          organizationId,
          phone: fromPhone,
          firstName: fromName !== fromPhone ? fromName : null,
          source: 'whatsapp',
          status: 'ACTIVE',
        },
      });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId: dbContact.id,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId: dbContact.id,
          isRead: false,
          unreadCount: 1,
        },
      });
    } else {
      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          isRead: false,
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });
    }

    // Extract message content
    const { content, mediaUrl, mediaType, mediaMimeType } = extractMessageContent(message);

    // Save message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        whatsappAccountId: account.id,
        waMessageId: message.id,
        direction: 'INBOUND',
        type: mapWebhookMessageType(message.type),
        content,
        mediaUrl,
        mediaType,
        mediaMimeType,
        status: 'DELIVERED',
        deliveredAt: new Date(parseInt(message.timestamp) * 1000),
        replyToMessageId: message.context?.id || null,
        metadata: JSON.parse(JSON.stringify(message)),
      },
    });

    // Update contact last message time
    await prisma.contact.update({
      where: { id: dbContact.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // Update conversation preview
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content?.substring(0, 100) || `[${message.type}]`,
      },
    });

    // Mark message as read on WhatsApp
    try {
      const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);
      await client.markAsRead(message.id);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  }

  // ==========================================
  // PROCESS STATUS UPDATE
  // ==========================================
  private async processStatusUpdate(status: WebhookStatus): Promise<void> {
    const messageId = status.id;
    const newStatus = status.status.toUpperCase() as MessageStatus;

    // Find message
    const message = await prisma.message.findUnique({
      where: { waMessageId: messageId },
    });

    if (!message) return;

    // Update message status
    const updateData: Prisma.MessageUpdateInput = {
      status: newStatus,
    };

    switch (status.status) {
      case 'sent':
        updateData.sentAt = new Date(parseInt(status.timestamp) * 1000);
        break;
      case 'delivered':
        updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
        break;
      case 'read':
        updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
        break;
      case 'failed':
        updateData.failedAt = new Date(parseInt(status.timestamp) * 1000);
        updateData.failureReason = status.errors?.[0]?.message || 'Unknown error';
        break;
    }

    await prisma.message.update({
      where: { id: message.id },
      data: updateData,
    });

    // Update campaign contact if exists
    if (message.conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: message.conversationId },
      });

      if (conversation) {
        await prisma.campaignContact.updateMany({
          where: {
            contactId: conversation.contactId,
            waMessageId: messageId,
          },
          data: {
            status: newStatus,
            ...(status.status === 'sent' && { sentAt: new Date(parseInt(status.timestamp) * 1000) }),
            ...(status.status === 'delivered' && { deliveredAt: new Date(parseInt(status.timestamp) * 1000) }),
            ...(status.status === 'read' && { readAt: new Date(parseInt(status.timestamp) * 1000) }),
            ...(status.status === 'failed' && { 
              failedAt: new Date(parseInt(status.timestamp) * 1000),
              failureReason: status.errors?.[0]?.message,
            }),
          },
        });
      }
    }
  }

  // ==========================================
  // SYNC TEMPLATES FROM META
  // ==========================================
  async syncTemplates(
    organizationId: string,
    whatsappAccountId: string
  ): Promise<{ synced: number; updated: number }> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    const metaTemplates = await client.getTemplates(account.wabaId);

    let synced = 0;
    let updated = 0;

    for (const metaTemplate of metaTemplates) {
      const existing = await prisma.template.findFirst({
        where: {
          organizationId,
          metaTemplateId: metaTemplate.id,
        },
      });

      const status = metaTemplate.status === 'APPROVED' ? 'APPROVED' : 
                     metaTemplate.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
      const category = metaTemplate.category === 'MARKETING' ? 'MARKETING' :
                       metaTemplate.category === 'UTILITY' ? 'UTILITY' : 'AUTHENTICATION';

      // Extract body text from components
      const bodyComponent = metaTemplate.components.find(c => c.type === 'BODY');
      const headerComponent = metaTemplate.components.find(c => c.type === 'HEADER');
      const footerComponent = metaTemplate.components.find(c => c.type === 'FOOTER');
      const buttonsComponent = metaTemplate.components.find(c => c.type === 'BUTTONS');

      if (existing) {
        await prisma.template.update({
          where: { id: existing.id },
          data: {
            status,
            rejectionReason: null,
          },
        });
        updated++;
      } else {
        await prisma.template.create({
          data: {
            organizationId,
            metaTemplateId: metaTemplate.id,
            name: metaTemplate.name,
            language: metaTemplate.language,
            category,
            headerType: headerComponent?.format || null,
            headerContent: headerComponent?.text || null,
            bodyText: bodyComponent?.text || '',
            footerText: footerComponent?.text || null,
            buttons: JSON.parse(JSON.stringify(buttonsComponent?.buttons || [])),
            variables: JSON.parse(JSON.stringify([])),
            status,
          },
        });
        synced++;
      }
    }

    return { synced, updated };
  }

  // ==========================================
  // GET MEDIA URL
  // ==========================================
  async getMediaUrl(
    organizationId: string,
    whatsappAccountId: string,
    mediaId: string
  ): Promise<{ url: string }> {
    const account = await this.getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const client = new MetaApiClient(account.accessToken, account.phoneNumberId, account.wabaId);

    const mediaInfo = await client.getMediaUrl(mediaId);

    return { url: mediaInfo.url };
  }

  // ==========================================
  // HELPER: GET ACCOUNT WITH TOKEN
  // ==========================================
  private async getWhatsAppAccountWithToken(
    organizationId: string,
    accountId: string
  ): Promise<any> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    if (account.status !== 'CONNECTED') {
      throw new AppError('WhatsApp account is not connected', 400);
    }

    if (!account.accessToken) {
      throw new AppError('WhatsApp account access token is missing', 400);
    }

    return account;
  }

  // ==========================================
  // HELPER: SAVE OUTBOUND MESSAGE
  // ==========================================
  private async saveOutboundMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    type: MessageType,
    content: string | null,
    waMessageId: string,
    replyToMessageId?: string,
    metadata?: any
  ): Promise<void> {
    // Clean phone number
    const cleanPhone = to.replace(/\D/g, '');

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        phone: cleanPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId,
          phone: cleanPhone,
          source: 'manual',
          status: 'ACTIVE',
        },
      });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId: contact.id,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId: contact.id,
        },
      });
    }

    // Save message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        whatsappAccountId,
        waMessageId,
        direction: 'OUTBOUND',
        type,
        content,
        status: 'PENDING',
        replyToMessageId,
        templateName: metadata?.templateName,
        templateParams: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
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
  }

  // ==========================================
  // VERIFY WEBHOOK
  // ==========================================
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();