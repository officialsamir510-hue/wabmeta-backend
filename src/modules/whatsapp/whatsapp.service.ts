// src/modules/whatsapp/whatsapp.service.ts

import {
  PrismaClient,
  MessageStatus,
  MessageDirection,
  MessageType,
  WhatsAppAccountStatus,
} from '@prisma/client';
import { metaApi } from '../meta/meta.api';
import { safeDecrypt, maskToken } from '../../utils/encryption';

const prisma = new PrismaClient();

// ============================================
// INTERFACES
// ============================================

interface SendMessageOptions {
  accountId: string;
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio';
  content: any;
  conversationId?: string;
  organizationId?: string;
}

interface SendTemplateOptions {
  accountId: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  components?: any[];
  conversationId?: string;
  organizationId?: string;
}

interface SendBulkOptions {
  accountId: string;
  recipients: Array<{
    phone: string;
    variables?: Record<string, string>;
  }>;
  templateName: string;
  templateLanguage: string;
  components?: any[];
  organizationId?: string;
}

interface CampaignSendResult {
  sent: number;
  failed: number;
  errors: string[];
}

// ============================================
// WHATSAPP SERVICE CLASS
// ============================================

class WhatsAppService {
  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get account with safe token decryption
   */
  private async getAccountWithToken(accountId: string): Promise<{
    account: any;
    accessToken: string;
  }> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      include: { organization: true },
    });

    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    if (account.status !== WhatsAppAccountStatus.CONNECTED) {
      throw new Error('WhatsApp account is not connected');
    }

    if (!account.accessToken) {
      throw new Error('No access token found for this account');
    }

    // Safe decryption with fallback
    const accessToken = safeDecrypt(account.accessToken);

    if (!accessToken) {
      console.error(`❌ Failed to decrypt token for account ${accountId}`);
      throw new Error('Failed to decrypt access token. Please reconnect your WhatsApp account.');
    }

    // Log safely with masked token
    console.log(`🔑 Token retrieved for account ${accountId}: ${maskToken(accessToken)}`);

    return { account, accessToken };
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Get or create contact
   */
  private async getOrCreateContact(
    organizationId: string,
    phone: string
  ): Promise<any> {
    const formattedPhone = phone.startsWith('+') ? phone : `+${this.formatPhoneNumber(phone)}`;

    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone: formattedPhone,
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId,
          phone: formattedPhone,
          source: 'WHATSAPP',
        },
      });
      console.log(`👤 Created new contact: ${contact.id}`);
    }

    return contact;
  }

  /**
   * Get or create conversation
   */
  private async getOrCreateConversation(
    organizationId: string,
    contactId: string,
    phoneNumberId: string,
    messagePreview: string,
    existingConversationId?: string
  ): Promise<any> {
    let conversation = existingConversationId
      ? await prisma.conversation.findUnique({ where: { id: existingConversationId } })
      : await prisma.conversation.findUnique({
        where: {
          organizationId_contactId: {
            organizationId,
            contactId,
          },
        },
      });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          phoneNumberId,
          contactId,
          lastMessageAt: new Date(),
          lastMessagePreview: messagePreview,
        },
      });
      console.log(`💬 Created new conversation: ${conversation.id}`);
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: messagePreview,
          unreadCount: 0,
        },
      });
    }

    return conversation;
  }

  // ============================================
  // MESSAGE SENDING METHODS
  // ============================================

  /**
   * Send a text message
   */
  async sendTextMessage(
    accountId: string,
    to: string,
    text: string,
    conversationId?: string,
    organizationId?: string
  ) {
    return this.sendMessage({
      accountId,
      to,
      type: 'text',
      content: { text: { body: text } },
      conversationId,
      organizationId,
    });
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(options: SendTemplateOptions) {
    const {
      accountId,
      to,
      templateName,
      templateLanguage,
      components,
      conversationId,
      organizationId,
    } = options;

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
      organizationId,
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
    conversationId?: string,
    organizationId?: string
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
      organizationId,
    });
  }

  /**
   * Core send message function
   */
  async sendMessage(options: SendMessageOptions) {
    const { accountId, to, type, content, conversationId } = options;

    try {
      // Get account with decrypted token
      const { account, accessToken } = await this.getAccountWithToken(accountId);

      // Use provided organizationId or get from account
      const organizationId = options.organizationId || account.organizationId;

      console.log(`📤 Sending ${type} message via account ${accountId} to ${to}`);

      // Format phone number
      const formattedTo = this.formatPhoneNumber(to);

      // Prepare message payload
      const messagePayload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type,
        ...content,
      };

      // Send via Meta API
      const result = await metaApi.sendMessage(
        account.phoneNumberId,
        accessToken,
        formattedTo,
        messagePayload
      );

      console.log(`✅ Message sent successfully: ${result.messageId}`);

      // Get or create contact
      const contact = await this.getOrCreateContact(organizationId, to);

      // Get message preview
      const messagePreview = this.getMessagePreview(type, content);

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(
        organizationId,
        contact.id,
        account.phoneNumberId,
        messagePreview,
        conversationId
      );

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
      console.error('❌ Failed to send message:', {
        error: error.message,
        response: error.response?.data,
      });

      // Save failed message for tracking
      if (conversationId) {
        try {
          await prisma.message.create({
            data: {
              conversationId,
              whatsappAccountId: accountId,
              direction: MessageDirection.OUTBOUND,
              type: this.mapMessageType(type),
              content: typeof content === 'string' ? content : JSON.stringify(content),
              status: MessageStatus.FAILED,
              failureReason: error.response?.data?.error?.message || error.message,
              sentAt: new Date(),
            },
          });
        } catch (dbError) {
          console.error('Failed to save error message to DB:', dbError);
        }
      }

      // Extract meaningful error message
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to send message';

      throw new Error(errorMessage);
    }
  }

  // ============================================
  // CAMPAIGN METHODS
  // ============================================

  /**
   * Send bulk campaign messages
   */
  async sendCampaignMessages(
    campaignId: string,
    batchSize: number = 50,
    delayMs: number = 1000
  ): Promise<CampaignSendResult> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        whatsappAccount: true,
        CampaignContact: {
          where: { status: MessageStatus.PENDING },
          include: { Contact: true },
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

    // Get decrypted access token
    let accessToken: string;
    try {
      const tokenResult = await this.getAccountWithToken(campaign.whatsappAccount.id);
      accessToken = tokenResult.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to get access token for campaign:', error);

      // Update campaign with failure reason
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
        },
      });

      throw new Error('Failed to get access token for campaign. Please reconnect WhatsApp account.');
    }

    console.log(`📢 Running campaign ${campaignId} with ${campaign.CampaignContact.length} recipients`);

    const results: CampaignSendResult = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const recipient of campaign.CampaignContact) {
      try {
        // Build template components
        const components = this.buildTemplateComponents(campaign.template, {});

        // Format phone number
        const formattedPhone = this.formatPhoneNumber(recipient.Contact.phone);

        // Send message
        const messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: campaign.template.name,
            language: { code: campaign.template.language },
            components,
          },
        };

        const messageResult = await metaApi.sendMessage(
          campaign.whatsappAccount.phoneNumberId,
          accessToken,
          formattedPhone,
          messagePayload
        );

        // Update contact status
        await this.updateContactStatus(
          campaignId,
          recipient.contactId,
          MessageStatus.SENT,
          messageResult.messageId
        );

        results.sent++;
        console.log(`✅ Sent to ${recipient.Contact.phone} (${messageResult.messageId})`);

        // Delay between messages
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        console.error(`❌ Failed to send to ${recipient.Contact.phone}:`, error.message);

        const errorMessage =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message;

        // Update contact status
        await this.updateContactStatus(
          campaignId,
          recipient.contactId,
          MessageStatus.FAILED,
          undefined,
          errorMessage
        );

        results.failed++;
        results.errors.push(`${recipient.Contact.phone}: ${errorMessage}`);
      }
    }

    // Check if campaign is complete
    await this.checkCampaignCompletion(campaignId);

    return results;
  }

  /**
   * Update campaign contact status
   */
  async updateContactStatus(
    campaignId: string,
    contactId: string,
    status: MessageStatus,
    waMessageId?: string,
    failureReason?: string
  ): Promise<void> {
    const now = new Date();

    // Build update data dynamically
    const updateData: Record<string, any> = {
      status,
      updatedAt: now,
    };

    if (waMessageId) {
      updateData.waMessageId = waMessageId;
    }

    // Add timestamp based on status
    switch (status) {
      case MessageStatus.SENT:
        updateData.sentAt = now;
        break;
      case MessageStatus.DELIVERED:
        updateData.deliveredAt = now;
        break;
      case MessageStatus.READ:
        updateData.readAt = now;
        break;
      case MessageStatus.FAILED:
        updateData.failedAt = now;
        if (failureReason) {
          updateData.failureReason = failureReason;
        }
        break;
    }

    // Update CampaignContact
    await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        contactId,
      },
      data: updateData,
    });

    // Update Campaign Counts
    const countFieldMap: Record<string, string> = {
      SENT: 'sentCount',
      DELIVERED: 'deliveredCount',
      READ: 'readCount',
      FAILED: 'failedCount',
    };

    const fieldToIncrement = countFieldMap[status];

    if (fieldToIncrement) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [fieldToIncrement]: { increment: 1 },
        },
      });
    }
  }

  /**
   * Check if campaign is complete and update status
   */
  async checkCampaignCompletion(campaignId: string): Promise<boolean> {
    const remainingRecipients = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: MessageStatus.PENDING,
      },
    });

    if (remainingRecipients === 0) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { sentCount: true, failedCount: true },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(
        `🎉 Campaign ${campaignId} completed! Sent: ${campaign?.sentCount || 0}, Failed: ${campaign?.failedCount || 0}`
      );
      return true;
    }

    return false;
  }

  // ============================================
  // MESSAGE STATUS METHODS
  // ============================================

  /**
   * Mark message as read
   */
  async markAsRead(accountId: string, messageId: string) {
    try {
      const { account, accessToken } = await this.getAccountWithToken(accountId);

      await metaApi.markMessageAsRead(account.phoneNumberId, accessToken, messageId);

      console.log(`✅ Marked message ${messageId} as read`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to mark as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update message status from webhook
   */
  async updateMessageStatus(
    wamId: string,
    status: MessageStatus,
    timestamp?: Date,
    errorInfo?: { code: number; title: string }
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        status,
      };

      switch (status) {
        case MessageStatus.DELIVERED:
          updateData.deliveredAt = timestamp || new Date();
          break;
        case MessageStatus.READ:
          updateData.readAt = timestamp || new Date();
          break;
        case MessageStatus.FAILED:
          updateData.failedAt = timestamp || new Date();
          if (errorInfo) {
            updateData.failureReason = `${errorInfo.code}: ${errorInfo.title}`;
          }
          break;
      }

      await prisma.message.updateMany({
        where: { wamId },
        data: updateData,
      });

      console.log(`📝 Updated message ${wamId} status to ${status}`);
    } catch (error: any) {
      console.error(`❌ Failed to update message status for ${wamId}:`, error);
    }
  }

  // ============================================
  // TEMPLATE HELPER METHODS
  // ============================================

  /**
   * Build template components with variables
   */
  private buildTemplateComponents(
    template: any,
    variables: Record<string, string>
  ): any[] {
    const components: any[] = [];

    // Header component
    if (template.headerType) {
      if (template.headerType === 'TEXT' && template.headerContent) {
        const headerVars = this.extractVariables(template.headerContent, variables);
        if (headerVars.length > 0) {
          components.push({
            type: 'header',
            parameters: headerVars,
          });
        }
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
        const mediaUrl = variables.header_media || template.headerMediaUrl;
        if (mediaUrl) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: template.headerType.toLowerCase(),
                [template.headerType.toLowerCase()]: {
                  link: mediaUrl,
                },
              },
            ],
          });
        }
      }
    }

    // Body component
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
      const buttons =
        typeof template.buttons === 'string'
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

  /**
   * Extract variable placeholders from template text
   */
  private extractVariablesFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((_, index) => `var_${index + 1}`);
  }

  /**
   * Extract and replace variables in text
   */
  private extractVariables(
    text: string,
    variables: Record<string, string>
  ): any[] {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((match, index) => ({
      type: 'text',
      text: variables[`var_${index + 1}`] || match,
    }));
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate message preview for conversation list
   */
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
      case 'location':
        return '📍 Location';
      case 'sticker':
        return '🎭 Sticker';
      case 'contacts':
        return '👤 Contact';
      default:
        return 'Message';
    }
  }

  /**
   * Map string type to MessageType enum
   */
  private mapMessageType(type: string): MessageType {
    const map: Record<string, MessageType> = {
      text: MessageType.TEXT,
      template: MessageType.TEMPLATE,
      image: MessageType.IMAGE,
      video: MessageType.VIDEO,
      audio: MessageType.AUDIO,
      document: MessageType.DOCUMENT,
      location: MessageType.LOCATION,
      sticker: MessageType.STICKER,
      contacts: MessageType.CONTACT,
      button: MessageType.INTERACTIVE,
      list: MessageType.INTERACTIVE,
      interactive: MessageType.INTERACTIVE,
    };
    return map[type.toLowerCase()] || MessageType.TEXT;
  }

  // ============================================
  // ACCOUNT MANAGEMENT METHODS
  // ============================================

  /**
   * Get default WhatsApp account for organization
   */
  async getDefaultAccount(organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        isDefault: true,
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    if (!account) {
      // Fallback to any connected account
      return prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: WhatsAppAccountStatus.CONNECTED,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return account;
  }

  /**
   * Validate account has required permissions
   */
  async validateAccount(accountId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const { account, accessToken } = await this.getAccountWithToken(accountId);

      // Test token validity with Meta API
      const isValid = await metaApi.validateToken(accessToken);

      if (!isValid) {
        return {
          valid: false,
          reason: 'Access token is invalid or expired',
        };
      }

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        reason: error.message,
      };
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
export default whatsappService;