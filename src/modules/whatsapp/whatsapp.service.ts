// src/modules/whatsapp/whatsapp.service.ts

import { PrismaClient, MessageStatus, MessageDirection, MessageType } from '@prisma/client';
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

    if (account.status !== 'ACTIVE') {
      throw new Error('WhatsApp account is not active');
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
            waId: formattedTo,
            source: 'MANUAL',
          },
        });
      }

      // Find or create conversation
      let conversation = conversationId
        ? await prisma.conversation.findUnique({ where: { id: conversationId } })
        : await prisma.conversation.findUnique({
            where: {
              whatsappAccountId_contactId: {
                whatsappAccountId: accountId,
                contactId: contact.id,
              },
            },
          });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: account.organizationId,
            whatsappAccountId: accountId,
            contactId: contact.id,
            status: 'OPEN',
            lastMessageAt: new Date(),
            lastMessageText: this.getMessagePreview(type, content),
          },
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessageText: this.getMessagePreview(type, content),
          },
        });
      }

      // Save message to database
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          wamId: result.messageId,
          direction: 'OUTBOUND',
          type: this.mapMessageType(type),
          content: content,
          status: 'SENT',
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
            direction: 'OUTBOUND',
            type: this.mapMessageType(type),
            content: content,
            status: 'FAILED',
            errorMessage: error.message,
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
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        whatsappAccount: true,
        recipients: {
          where: { status: 'PENDING' },
          include: { contact: true },
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

    const accessToken = decrypt(campaign.whatsappAccount.accessToken);
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const recipient of campaign.recipients) {
      try {
        // Build template components with variables
        const components = this.buildTemplateComponents(
          campaign.template,
          recipient.variables as any
        );

        // Send message
        const messageResult = await metaApi.sendMessage(
          campaign.whatsappAccount.phoneNumberId,
          accessToken,
          recipient.contact.phone.replace(/[^0-9]/g, ''),
          {
            type: 'template',
            template: {
              name: campaign.template.name,
              language: { code: campaign.template.language },
              components,
            },
          }
        );

        // Update recipient status
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            wamId: messageResult.messageId,
            sentAt: new Date(),
          },
        });

        // Update campaign stats
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            sent: { increment: 1 },
          },
        });

        results.sent++;

        // Delay between messages
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.contact.phone}:`, error);

        // Update recipient as failed
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error.message,
          },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            failed: { increment: 1 },
          },
        });

        results.failed++;
        results.errors.push(`${recipient.contact.phone}: ${error.message}`);
      }
    }

    // Check if campaign is complete
    const remainingRecipients = await prisma.campaignRecipient.count({
      where: {
        campaignId,
        status: 'PENDING',
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

    // Body component
    if (template.bodyVariables && template.bodyVariables.length > 0) {
      const bodyParams = template.bodyVariables.map((varName: string, index: number) => ({
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
      const buttons = template.buttons as any[];
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

    return components;
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
      text: 'TEXT',
      template: 'TEMPLATE',
      image: 'IMAGE',
      video: 'VIDEO',
      audio: 'AUDIO',
      document: 'DOCUMENT',
    };
    return map[type] || 'TEXT';
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;