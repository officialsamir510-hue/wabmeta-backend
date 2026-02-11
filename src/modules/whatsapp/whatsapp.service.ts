// src/modules/whatsapp/whatsapp.service.ts

import { PrismaClient, MessageStatus, MessageDirection, MessageType, WhatsAppAccountStatus } from '@prisma/client';
import { metaApi } from '../meta/meta.api';
import { decrypt } from '../../utils/encryption';

const prisma = new PrismaClient();

interface SendMessageOptions {
  accountId: string;
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio';
  content: any;
  conversationId?: string;
}

interface SendTemplateOptions {
  accountId: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  components?: any[];
  conversationId?: string;
}

class WhatsAppService {
  /**
   * Send a text message
   */
  async sendTextMessage(
    accountId: string,
    to: string,
    text: string,
    conversationId?: string
  ) {
    return this.sendMessage({
      accountId,
      to,
      type: 'text',
      content: { text: { body: text } },
      conversationId,
    });
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(options: SendTemplateOptions) {
    const { accountId, to, templateName, templateLanguage, components, conversationId } =
      options;

    return this.sendMessage({
      accountId,
      to,
      type: 'template',
      content: {
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: components || [],
        },
      },
      conversationId,
    });
  }

  /**
   * Send a media message
   */
  async sendMediaMessage(
    accountId: string,
    to: string,
    mediaType: 'image' | 'document' | 'video' | 'audio',
    mediaUrl: string,
    caption?: string,
    conversationId?: string
  ) {
    const content: any = {
      [mediaType]: {
        link: mediaUrl,
      },
    };

    if (caption && ['image', 'document', 'video'].includes(mediaType)) {
      content[mediaType].caption = caption;
    }

    return this.sendMessage({
      accountId,
      to,
      type: mediaType,
      content,
      conversationId,
    });
  }

  /**
   * Core send message function
   */
  async sendMessage(options: SendMessageOptions) {
    const { accountId, to, type, content, conversationId } = options;

    // Get account with access token
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      include: { organization: true },
    });

    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    // ✅ Fixed: Use WhatsAppAccountStatus.CONNECTED instead of 'ACTIVE'
    if (account.status !== WhatsAppAccountStatus.CONNECTED) {
      throw new Error('WhatsApp account is not active');
    }

    // ✅ Fixed: Add null check for accessToken
    if (!account.accessToken) {
      throw new Error('Access token not found');
    }
    const accessToken = decrypt(account.accessToken);

    // Format phone number (remove + and spaces)
    const formattedTo = to.replace(/[^0-9]/g, '');

    // Prepare message payload
    const messagePayload: any = {
      type,
      ...content,
    };

    try {
      // Send via Meta API
      const result = await metaApi.sendMessage(
        account.phoneNumberId,
        accessToken,
        formattedTo,
        messagePayload
      );

      // Find or create contact
      let contact = await prisma.contact.findUnique({
        where: {
          organizationId_phone: {
            organizationId: account.organizationId,
            phone: to.startsWith('+') ? to : `+${formattedTo}`,
          },
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId: account.organizationId,
            phone: to.startsWith('+') ? to : `+${formattedTo}`,
            // ✅ Fixed: Removed waId (not in schema)
            source: 'MANUAL',
          },
        });
      }

      // Find or create conversation
      // ✅ Fixed: Use organizationId_contactId instead of whatsappAccountId_contactId
      let conversation = conversationId
        ? await prisma.conversation.findUnique({ where: { id: conversationId } })
        : await prisma.conversation.findUnique({
            where: {
              organizationId_contactId: {
                organizationId: account.organizationId,
                contactId: contact.id,
              },
            },
          });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: account.organizationId,
            // ✅ Fixed: Removed whatsappAccountId (not in schema, use phoneNumberId)
            phoneNumberId: null, // Optional in schema
            contactId: contact.id,
            // ✅ Fixed: Removed status (not in schema)
            lastMessageAt: new Date(),
            lastMessagePreview: this.getMessagePreview(type, content), // ✅ Fixed: lastMessageText -> lastMessagePreview
          },
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: this.getMessagePreview(type, content), // ✅ Fixed
          },
        });
      }

      // Save message to database
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          wamId: result.messageId,
          direction: MessageDirection.OUTBOUND,
          type: this.mapMessageType(type),
          content: typeof content === 'string' ? content : JSON.stringify(content),
          status: MessageStatus.SENT,
          sentAt: new Date(),
        },
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
      });

      return {
        success: true,
        messageId: result.messageId,
        message,
      };
    } catch (error: any) {
      console.error('Failed to send message:', error);

      // Still save the failed message for tracking
      if (conversationId) {
        await prisma.message.create({
          data: {
            conversationId,
            whatsappAccountId: accountId,
            direction: MessageDirection.OUTBOUND,
            type: this.mapMessageType(type),
            content: typeof content === 'string' ? content : JSON.stringify(content),
            status: MessageStatus.FAILED,
            failureReason: error.message, // ✅ Fixed: errorMessage -> failureReason
          },
        });
      }

      throw new Error(error.message || 'Failed to send message');
    }
  }

  /**
   * Send bulk campaign messages
   */
  async sendCampaignMessages(
    campaignId: string,
    batchSize: number = 50,
    delayMs: number = 1000
  ) {
    // ✅ Fixed: Use correct includes
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        whatsappAccount: true,
        CampaignContact: {  // ✅ Fixed: recipients -> CampaignContact
          where: { status: MessageStatus.PENDING },
          include: { Contact: true },  // ✅ Fixed: contact -> Contact
          take: batchSize,
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'RUNNING') {
      throw new Error('Campaign is not running');
    }

    // ✅ Fixed: Add null check for accessToken
    if (!campaign.whatsappAccount.accessToken) {
      throw new Error('Access token not found');
    }
    const accessToken = decrypt(campaign.whatsappAccount.accessToken);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // ✅ Fixed: Use CampaignContact instead of recipients
    for (const recipient of campaign.CampaignContact) {
      try {
        // Build template components with variables
        const components = this.buildTemplateComponents(
          campaign.template,
          {} // Variables would come from recipient data if needed
        );

        // Send message
        const messageResult = await metaApi.sendMessage(
          campaign.whatsappAccount.phoneNumberId,
          accessToken,
          recipient.Contact.phone.replace(/[^0-9]/g, ''),
          {
            type: 'template',
            template: {
              name: campaign.template.name,
              language: { code: campaign.template.language },
              components,
            },
          }
        );

        // ✅ Fixed: Use campaignContact instead of campaignRecipient
        await prisma.campaignContact.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.SENT,
            waMessageId: messageResult.messageId, // ✅ Fixed: wamId -> waMessageId
            sentAt: new Date(),
          },
        });

        // ✅ Fixed: Use sentCount instead of sent
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            sentCount: { increment: 1 },
          },
        });

        results.sent++;

        // Delay between messages
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.Contact.phone}:`, error);

        // ✅ Fixed: Use campaignContact
        await prisma.campaignContact.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.FAILED,
            failedAt: new Date(),
            failureReason: error.message, // ✅ Fixed: errorMessage -> failureReason
          },
        });

        // ✅ Fixed: Use failedCount instead of failed
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            failedCount: { increment: 1 },
          },
        });

        results.failed++;
        results.errors.push(`${recipient.Contact.phone}: ${error.message}`);
      }
    }

    // ✅ Fixed: Use campaignContact
    const remainingRecipients = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: MessageStatus.PENDING,
      },
    });

    if (remainingRecipients === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    return results;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(accountId: string, messageId: string) {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // ✅ Fixed: Add null check for accessToken
    if (!account.accessToken) {
      throw new Error('Access token not found');
    }
    const accessToken = decrypt(account.accessToken);

    try {
      await metaApi.sendMessage(account.phoneNumberId, accessToken, '', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to mark as read:', error);
      return { success: false };
    }
  }

  private buildTemplateComponents(template: any, variables: Record<string, string>) {
    const components: any[] = [];

    // Header component
    if (template.headerType) {
      if (template.headerType === 'TEXT' && template.headerContent) {
        components.push({
          type: 'header',
          parameters: this.extractVariables(template.headerContent, variables),
        });
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
        components.push({
          type: 'header',
          parameters: [
            {
              type: template.headerType.toLowerCase(),
              [template.headerType.toLowerCase()]: {
                link: variables.header_media || template.headerMediaUrl,
              },
            },
          ],
        });
      }
    }

    // Body component - extract variables from bodyText
    const bodyVars = this.extractVariablesFromText(template.bodyText);
    if (bodyVars.length > 0) {
      const bodyParams = bodyVars.map((varName: string, index: number) => ({
        type: 'text',
        text: variables[varName] || variables[`body_${index + 1}`] || `{{${index + 1}}}`,
      }));

      components.push({
        type: 'body',
        parameters: bodyParams,
      });
    }

    // Button components
    if (template.buttons) {
      const buttons = typeof template.buttons === 'string' 
        ? JSON.parse(template.buttons) 
        : template.buttons;
      
      if (Array.isArray(buttons)) {
        buttons.forEach((button: any, index: number) => {
          if (button.type === 'URL' && button.url?.includes('{{')) {
            components.push({
              type: 'button',
              sub_type: 'url',
              index,
              parameters: [
                {
                  type: 'text',
                  text: variables[`button_${index}`] || '',
                },
              ],
            });
          }
        });
      }
    }

    return components;
  }

  private extractVariablesFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((_, index) => `var_${index + 1}`);
  }

  private extractVariables(text: string, variables: Record<string, string>) {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((match, index) => ({
      type: 'text',
      text: variables[`var_${index + 1}`] || match,
    }));
  }

  private getMessagePreview(type: string, content: any): string {
    switch (type) {
      case 'text':
        return content.text?.body?.substring(0, 100) || '';
      case 'template':
        return `📋 Template: ${content.template?.name}`;
      case 'image':
        return '📷 Image';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'document':
        return '📄 Document';
      default:
        return 'Message';
    }
  }

  private mapMessageType(type: string): MessageType {
    const map: Record<string, MessageType> = {
      text: MessageType.TEXT,
      template: MessageType.TEMPLATE,
      image: MessageType.IMAGE,
      video: MessageType.VIDEO,
      audio: MessageType.AUDIO,
      document: MessageType.DOCUMENT,
    };
    return map[type] || MessageType.TEXT;
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;