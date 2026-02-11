"use strict";
// src/modules/whatsapp/whatsapp.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("../meta/meta.api");
const encryption_1 = require("../../utils/encryption");
const prisma = new client_1.PrismaClient();
class WhatsAppService {
    /**
     * Send a text message
     */
    async sendTextMessage(accountId, to, text, conversationId) {
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
    async sendTemplateMessage(options) {
        const { accountId, to, templateName, templateLanguage, components, conversationId } = options;
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
    async sendMediaMessage(accountId, to, mediaType, mediaUrl, caption, conversationId) {
        const content = {
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
    async sendMessage(options) {
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
        if (account.status !== client_1.WhatsAppAccountStatus.CONNECTED) {
            throw new Error('WhatsApp account is not active');
        }
        // ✅ Fixed: Add null check for accessToken
        if (!account.accessToken) {
            throw new Error('Access token not found');
        }
        const accessToken = (0, encryption_1.decrypt)(account.accessToken);
        // Format phone number (remove + and spaces)
        const formattedTo = to.replace(/[^0-9]/g, '');
        // Prepare message payload
        const messagePayload = {
            type,
            ...content,
        };
        try {
            // Send via Meta API
            const result = await meta_api_1.metaApi.sendMessage(account.phoneNumberId, accessToken, formattedTo, messagePayload);
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
            }
            else {
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
                    direction: client_1.MessageDirection.OUTBOUND,
                    type: this.mapMessageType(type),
                    content: typeof content === 'string' ? content : JSON.stringify(content),
                    status: client_1.MessageStatus.SENT,
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
        }
        catch (error) {
            console.error('Failed to send message:', error);
            // Still save the failed message for tracking
            if (conversationId) {
                await prisma.message.create({
                    data: {
                        conversationId,
                        whatsappAccountId: accountId,
                        direction: client_1.MessageDirection.OUTBOUND,
                        type: this.mapMessageType(type),
                        content: typeof content === 'string' ? content : JSON.stringify(content),
                        status: client_1.MessageStatus.FAILED,
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
    async sendCampaignMessages(campaignId, batchSize = 50, delayMs = 1000) {
        // ✅ Fixed: Use correct includes
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                template: true,
                whatsappAccount: true,
                CampaignContact: {
                    where: { status: client_1.MessageStatus.PENDING },
                    include: { Contact: true }, // ✅ Fixed: contact -> Contact
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
        const accessToken = (0, encryption_1.decrypt)(campaign.whatsappAccount.accessToken);
        const results = {
            sent: 0,
            failed: 0,
            errors: [],
        };
        // ✅ Fixed: Use CampaignContact instead of recipients
        for (const recipient of campaign.CampaignContact) {
            try {
                // Build template components with variables
                const components = this.buildTemplateComponents(campaign.template, {} // Variables would come from recipient data if needed
                );
                // Send message
                const messageResult = await meta_api_1.metaApi.sendMessage(campaign.whatsappAccount.phoneNumberId, accessToken, recipient.Contact.phone.replace(/[^0-9]/g, ''), {
                    type: 'template',
                    template: {
                        name: campaign.template.name,
                        language: { code: campaign.template.language },
                        components,
                    },
                });
                // ✅ Fixed: Use campaignContact instead of campaignRecipient
                await prisma.campaignContact.update({
                    where: { id: recipient.id },
                    data: {
                        status: client_1.MessageStatus.SENT,
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
            }
            catch (error) {
                console.error(`Failed to send to ${recipient.Contact.phone}:`, error);
                // ✅ Fixed: Use campaignContact
                await prisma.campaignContact.update({
                    where: { id: recipient.id },
                    data: {
                        status: client_1.MessageStatus.FAILED,
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
                status: client_1.MessageStatus.PENDING,
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
    async markAsRead(accountId, messageId) {
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
        const accessToken = (0, encryption_1.decrypt)(account.accessToken);
        try {
            await meta_api_1.metaApi.sendMessage(account.phoneNumberId, accessToken, '', {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            });
            return { success: true };
        }
        catch (error) {
            console.error('Failed to mark as read:', error);
            return { success: false };
        }
    }
    buildTemplateComponents(template, variables) {
        const components = [];
        // Header component
        if (template.headerType) {
            if (template.headerType === 'TEXT' && template.headerContent) {
                components.push({
                    type: 'header',
                    parameters: this.extractVariables(template.headerContent, variables),
                });
            }
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
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
            const bodyParams = bodyVars.map((varName, index) => ({
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
                buttons.forEach((button, index) => {
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
    extractVariablesFromText(text) {
        if (!text)
            return [];
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        return matches.map((_, index) => `var_${index + 1}`);
    }
    extractVariables(text, variables) {
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        return matches.map((match, index) => ({
            type: 'text',
            text: variables[`var_${index + 1}`] || match,
        }));
    }
    getMessagePreview(type, content) {
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
    mapMessageType(type) {
        const map = {
            text: client_1.MessageType.TEXT,
            template: client_1.MessageType.TEMPLATE,
            image: client_1.MessageType.IMAGE,
            video: client_1.MessageType.VIDEO,
            audio: client_1.MessageType.AUDIO,
            document: client_1.MessageType.DOCUMENT,
        };
        return map[type] || client_1.MessageType.TEXT;
    }
}
exports.whatsappService = new WhatsAppService();
exports.default = exports.whatsappService;
//# sourceMappingURL=whatsapp.service.js.map