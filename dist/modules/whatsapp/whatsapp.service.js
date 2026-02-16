"use strict";
// src/modules/whatsapp/whatsapp.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("../meta/meta.api");
const encryption_1 = require("../../utils/encryption");
const prisma = new client_1.PrismaClient();
// ============================================
// WHATSAPP SERVICE CLASS
// ============================================
class WhatsAppService {
    // ============================================
    // HELPER METHODS
    // ============================================
    /**
     * Check if a string looks like a Meta access token
     */
    looksLikeAccessToken(value) {
        if (!value || typeof value !== 'string')
            return false;
        return (value.startsWith('EAA') ||
            value.startsWith('EAAG') ||
            value.startsWith('EAAI'));
    }
    /**
     * Get account with safe token decryption - ✅ FIXED VERSION
     */
    async getAccountWithToken(accountId) {
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId },
            include: { organization: true },
        });
        if (!account) {
            console.error(`❌ Account not found: ${accountId}`);
            throw new Error('WhatsApp account not found');
        }
        if (account.status !== client_1.WhatsAppAccountStatus.CONNECTED) {
            console.error(`❌ Account not connected: ${accountId}, status: ${account.status}`);
            throw new Error('WhatsApp account is not connected');
        }
        if (!account.accessToken) {
            console.error(`❌ No access token for account: ${accountId}`);
            throw new Error('No access token found for this account');
        }
        console.log(`🔐 Decrypting token for account ${accountId}...`);
        // ✅ SAFE DECRYPT - handles both encrypted and plain text tokens
        let accessToken = null;
        try {
            // Check if token is already a plain Meta token
            if (this.looksLikeAccessToken(account.accessToken)) {
                console.log(`📝 Token is already plain text (starts with EAA)`);
                accessToken = account.accessToken;
            }
            else {
                // Try to decrypt
                console.log(`🔓 Attempting to decrypt token...`);
                accessToken = (0, encryption_1.safeDecrypt)(account.accessToken);
            }
        }
        catch (decryptError) {
            console.error(`❌ Decryption error:`, decryptError.message);
            throw new Error('Failed to decrypt access token. Please reconnect your WhatsApp account.');
        }
        if (!accessToken) {
            console.error(`❌ Token is null after decryption attempt`);
            throw new Error('Failed to decrypt access token. Please reconnect your WhatsApp account.');
        }
        // ✅ Verify it's a valid Meta token after decryption
        if (!this.looksLikeAccessToken(accessToken)) {
            console.error(`❌ Decrypted token doesn't look like a Meta token`);
            console.error(`   Expected to start with: EAA`);
            console.error(`   Got (masked): ${(0, encryption_1.maskToken)(accessToken)}`);
            // Try to use it anyway if it's not empty, but log warning
            console.warn('⚠️ Token format suspicious, attempting to use anyway...');
        }
        console.log(`✅ Token ready: ${(0, encryption_1.maskToken)(accessToken)}`);
        return { account, accessToken };
    }
    /**
     * Format phone number for WhatsApp API
     */
    formatPhoneNumber(phone) {
        // Remove all non-numeric characters
        return phone.replace(/[^0-9]/g, '');
    }
    /**
     * Get or create contact
     */
    async getOrCreateContact(organizationId, phone) {
        const formattedPhone = phone.startsWith('+')
            ? phone
            : `+${this.formatPhoneNumber(phone)}`;
        // Try finding by exact match or just digits match
        const cleanPhone = this.formatPhoneNumber(phone);
        let contact = await prisma.contact.findFirst({
            where: {
                organizationId,
                OR: [
                    { phone: formattedPhone },
                    { phone: cleanPhone },
                    { phone: `+${cleanPhone}` }
                ]
            },
        });
        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    organizationId,
                    phone: formattedPhone,
                    source: 'WHATSAPP',
                    firstName: 'Unknown',
                    status: 'ACTIVE'
                },
            });
            console.log(`👤 Created new contact: ${contact.id}`);
        }
        return contact;
    }
    /**
     * Get or create conversation
     */
    async getOrCreateConversation(organizationId, contactId, phoneNumberId, messagePreview, existingConversationId) {
        let conversation = existingConversationId
            ? await prisma.conversation.findUnique({
                where: { id: existingConversationId },
            })
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
                    unreadCount: 0,
                    isWindowOpen: true
                },
            });
            console.log(`💬 Created new conversation: ${conversation.id}`);
        }
        else {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    lastMessagePreview: messagePreview,
                    isWindowOpen: true
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
    async sendTextMessage(accountId, to, text, conversationId, organizationId) {
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
     * Send a template message - ✅ FIXED VERSION
     */
    async sendTemplateMessage(options) {
        const { accountId, to, templateName, templateLanguage, components, conversationId, organizationId, } = options;
        console.log(`📋 Sending template message: ${templateName}`);
        console.log(`   To: ${to}`);
        console.log(`   Account ID: ${accountId}`);
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
    async sendMediaMessage(accountId, to, mediaType, mediaUrl, caption, conversationId, organizationId) {
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
            organizationId,
        });
    }
    /**
     * Core send message function - ✅ FIXED VERSION
     */
    async sendMessage(options) {
        const { accountId, to, type, content, conversationId } = options;
        console.log(`\n📤 ========== SEND MESSAGE START ==========`);
        console.log(`   Type: ${type}`);
        console.log(`   To: ${to}`);
        console.log(`   Account ID: ${accountId}`);
        try {
            // ✅ Get account with decrypted token
            const { account, accessToken } = await this.getAccountWithToken(accountId);
            // Use provided organizationId or get from account
            const organizationId = options.organizationId || account.organizationId;
            console.log(`   Organization ID: ${organizationId}`);
            console.log(`   Phone Number ID: ${account.phoneNumberId}`);
            // Format phone number
            const formattedTo = this.formatPhoneNumber(to);
            console.log(`   Formatted Phone: ${formattedTo}`);
            // Prepare message payload
            const messagePayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedTo,
                type,
                ...content,
            };
            console.log(`   Payload type:`, type);
            // ✅ Send via Meta API with decrypted token
            const result = await meta_api_1.metaApi.sendMessage(account.phoneNumberId, accessToken, formattedTo, messagePayload);
            console.log(`✅ Message sent successfully!`);
            console.log(`   Message ID: ${result.messageId}`);
            // Get or create contact
            const contact = await this.getOrCreateContact(organizationId, to);
            // Get message preview
            const messagePreview = this.getMessagePreview(type, content);
            // Get or create conversation
            const conversation = await this.getOrCreateConversation(organizationId, contact.id, account.phoneNumberId, messagePreview, conversationId);
            // Save message to database
            const message = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId: accountId,
                    wamId: result.messageId,
                    waMessageId: result.messageId, // Duplicate for backward compatibility
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
            console.log(`📤 ========== SEND MESSAGE END ==========\n`);
            return {
                success: true,
                messageId: result.messageId,
                message,
            };
        }
        catch (error) {
            console.error(`❌ Failed to send message:`, {
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
                            direction: client_1.MessageDirection.OUTBOUND,
                            type: this.mapMessageType(type),
                            content: typeof content === 'string' ? content : JSON.stringify(content),
                            status: client_1.MessageStatus.FAILED,
                            failureReason: error.response?.data?.error?.message || error.message,
                            sentAt: new Date(),
                        },
                    });
                }
                catch (dbError) {
                    console.error('Failed to save error message to DB:', dbError);
                }
            }
            console.log(`📤 ========== SEND MESSAGE END (ERROR) ==========\n`);
            // Extract meaningful error message
            const errorMessage = error.response?.data?.error?.message ||
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
     * Send bulk campaign messages - ✅ FIXED VERSION
     */
    async sendCampaignMessages(campaignId, batchSize = 50, delayMs = 1000) {
        console.log(`\n📢 ========== CAMPAIGN START ==========`);
        console.log(`   Campaign ID: ${campaignId}`);
        console.log(`   Batch Size: ${batchSize}`);
        console.log(`   Delay: ${delayMs}ms`);
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                template: true,
                whatsappAccount: true,
                campaignContacts: {
                    where: { status: client_1.MessageStatus.PENDING },
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
        console.log(`   Template: ${campaign.template.name}`);
        console.log(`   Recipients: ${campaign.campaignContacts.length}`);
        // ✅ Get decrypted access token
        let accessToken;
        try {
            const tokenResult = await this.getAccountWithToken(campaign.whatsappAccount.id);
            accessToken = tokenResult.accessToken;
        }
        catch (error) {
            console.error('❌ Failed to get access token for campaign:', error);
            // Update campaign with failure
            await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'FAILED',
                },
            });
            throw new Error('Failed to get access token for campaign. Please reconnect WhatsApp account.');
        }
        const results = {
            sent: 0,
            failed: 0,
            errors: [],
        };
        for (const recipient of campaign.campaignContacts) {
            try {
                // Build template components
                const components = this.buildTemplateComponents(campaign.template, {});
                // Format phone number
                const formattedPhone = this.formatPhoneNumber(recipient.contact.phone);
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
                const messageResult = await meta_api_1.metaApi.sendMessage(campaign.whatsappAccount.phoneNumberId, accessToken, formattedPhone, messagePayload);
                // Update contact status
                await this.updateContactStatus(campaignId, recipient.contactId, client_1.MessageStatus.SENT, messageResult.messageId);
                results.sent++;
                console.log(`✅ Sent to ${recipient.contact.phone} (${messageResult.messageId})`);
                // Delay between messages
                if (delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
            catch (error) {
                console.error(`❌ Failed to send to ${recipient.contact.phone}:`, error.message);
                const errorMessage = error.response?.data?.error?.message ||
                    error.response?.data?.message ||
                    error.message;
                // Update contact status
                await this.updateContactStatus(campaignId, recipient.contactId, client_1.MessageStatus.FAILED, undefined, errorMessage);
                results.failed++;
                results.errors.push(`${recipient.contact.phone}: ${errorMessage}`);
            }
        }
        // Check if campaign is complete
        await this.checkCampaignCompletion(campaignId);
        console.log(`📢 ========== CAMPAIGN END ==========`);
        console.log(`   Sent: ${results.sent}`);
        console.log(`   Failed: ${results.failed}\n`);
        return results;
    }
    /**
     * Update campaign contact status
     */
    async updateContactStatus(campaignId, contactId, status, waMessageId, failureReason) {
        const now = new Date();
        // Build update data dynamically
        const updateData = {
            status,
            updatedAt: now,
        };
        if (waMessageId) {
            updateData.waMessageId = waMessageId;
        }
        // Add timestamp based on status
        switch (status) {
            case client_1.MessageStatus.SENT:
                updateData.sentAt = now;
                break;
            case client_1.MessageStatus.DELIVERED:
                updateData.deliveredAt = now;
                break;
            case client_1.MessageStatus.READ:
                updateData.readAt = now;
                break;
            case client_1.MessageStatus.FAILED:
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
        const countFieldMap = {
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
    async checkCampaignCompletion(campaignId) {
        const remainingRecipients = await prisma.campaignContact.count({
            where: {
                campaignId,
                status: client_1.MessageStatus.PENDING,
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
            console.log(`🎉 Campaign ${campaignId} completed! Sent: ${campaign?.sentCount || 0}, Failed: ${campaign?.failedCount || 0}`);
            return true;
        }
        return false;
    }
    // ============================================
    // MESSAGE STATUS METHODS
    // ============================================
    /**
     * Mark message as read - ✅ FIXED VERSION
     */
    async markAsRead(accountId, messageId) {
        try {
            const { account, accessToken } = await this.getAccountWithToken(accountId);
            await meta_api_1.metaApi.markMessageAsRead(account.phoneNumberId, accessToken, messageId);
            // Also update DB
            await prisma.message.updateMany({
                where: { wamId: messageId },
                data: {
                    status: client_1.MessageStatus.READ,
                    readAt: new Date()
                }
            });
            console.log(`✅ Marked message ${messageId} as read`);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Failed to mark as read:', error);
            return { success: false, error: error.message };
        }
    }
    // ============================================
    // TEMPLATE HELPER METHODS
    // ============================================
    /**
     * Build template components with variables
     */
    buildTemplateComponents(template, variables) {
        const components = [];
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
            }
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
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
            const bodyParams = bodyVars.map((varName, index) => ({
                type: 'text',
                text: variables[varName] ||
                    variables[`body_${index + 1}`] ||
                    `{{${index + 1}}}`,
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
    /**
     * Extract variable placeholders from template text
     */
    extractVariablesFromText(text) {
        if (!text)
            return [];
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        return matches.map((_, index) => `var_${index + 1}`);
    }
    /**
     * Extract and replace variables in text
     */
    extractVariables(text, variables) {
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
    mapMessageType(type) {
        const map = {
            text: client_1.MessageType.TEXT,
            template: client_1.MessageType.TEMPLATE,
            image: client_1.MessageType.IMAGE,
            video: client_1.MessageType.VIDEO,
            audio: client_1.MessageType.AUDIO,
            document: client_1.MessageType.DOCUMENT,
            location: client_1.MessageType.LOCATION,
            sticker: client_1.MessageType.STICKER,
            contacts: client_1.MessageType.CONTACT,
            button: client_1.MessageType.INTERACTIVE,
            list: client_1.MessageType.INTERACTIVE,
            interactive: client_1.MessageType.INTERACTIVE,
        };
        return map[type.toLowerCase()] || client_1.MessageType.TEXT;
    }
    // ============================================
    // ACCOUNT MANAGEMENT METHODS
    // ============================================
    /**
     * Get default WhatsApp account for organization
     */
    async getDefaultAccount(organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                organizationId,
                isDefault: true,
                status: client_1.WhatsAppAccountStatus.CONNECTED,
            },
        });
        if (!account) {
            // Fallback to any connected account
            return prisma.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        return account;
    }
    /**
     * Validate account has required permissions - ✅ FIXED VERSION
     */
    async validateAccount(accountId) {
        try {
            const { accessToken } = await this.getAccountWithToken(accountId);
            // Test token validity with Meta API
            const isValid = await meta_api_1.metaApi.isTokenValid(accessToken);
            if (!isValid) {
                return {
                    valid: false,
                    reason: 'Access token is invalid or expired',
                };
            }
            return { valid: true };
        }
        catch (error) {
            return {
                valid: false,
                reason: error.message,
            };
        }
    }
}
// Export singleton instance
exports.whatsappService = new WhatsAppService();
exports.default = exports.whatsappService;
//# sourceMappingURL=whatsapp.service.js.map