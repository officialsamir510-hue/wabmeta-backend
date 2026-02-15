import { MessageStatus } from '@prisma/client';
interface SendMessageOptions {
    accountId: string;
    to: string;
    type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio' | 'interactive' | 'location' | 'contacts';
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
interface CampaignSendResult {
    sent: number;
    failed: number;
    errors: string[];
}
declare class WhatsAppService {
    /**
     * Check if a string looks like a Meta access token
     */
    private looksLikeAccessToken;
    /**
     * Get account with safe token decryption - ✅ FIXED VERSION
     */
    private getAccountWithToken;
    /**
     * Format phone number for WhatsApp API
     */
    private formatPhoneNumber;
    /**
     * Get or create contact
     */
    private getOrCreateContact;
    /**
     * Get or create conversation
     */
    private getOrCreateConversation;
    /**
     * Send a text message
     */
    sendTextMessage(accountId: string, to: string, text: string, conversationId?: string, organizationId?: string): Promise<{
        success: boolean;
        messageId: string;
        message: {
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    lastMessageAt: Date | null;
                    countryCode: string;
                    customFields: import("@prisma/client/runtime/library").JsonValue;
                    tags: string[];
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                phoneNumberId: string | null;
                contactId: string;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                assignedTo: string | null;
                labels: string[];
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            waMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
        };
    }>;
    /**
     * Send a template message - ✅ FIXED VERSION
     */
    sendTemplateMessage(options: SendTemplateOptions): Promise<{
        success: boolean;
        messageId: string;
        message: {
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    lastMessageAt: Date | null;
                    countryCode: string;
                    customFields: import("@prisma/client/runtime/library").JsonValue;
                    tags: string[];
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                phoneNumberId: string | null;
                contactId: string;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                assignedTo: string | null;
                labels: string[];
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            waMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
        };
    }>;
    /**
     * Send a media message
     */
    sendMediaMessage(accountId: string, to: string, mediaType: 'image' | 'document' | 'video' | 'audio', mediaUrl: string, caption?: string, conversationId?: string, organizationId?: string): Promise<{
        success: boolean;
        messageId: string;
        message: {
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    lastMessageAt: Date | null;
                    countryCode: string;
                    customFields: import("@prisma/client/runtime/library").JsonValue;
                    tags: string[];
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                phoneNumberId: string | null;
                contactId: string;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                assignedTo: string | null;
                labels: string[];
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            waMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
        };
    }>;
    /**
     * Core send message function - ✅ FIXED VERSION
     */
    sendMessage(options: SendMessageOptions): Promise<{
        success: boolean;
        messageId: string;
        message: {
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    lastMessageAt: Date | null;
                    countryCode: string;
                    customFields: import("@prisma/client/runtime/library").JsonValue;
                    tags: string[];
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                phoneNumberId: string | null;
                contactId: string;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                assignedTo: string | null;
                labels: string[];
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            waMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
        };
    }>;
    /**
     * Send bulk campaign messages - ✅ FIXED VERSION
     */
    sendCampaignMessages(campaignId: string, batchSize?: number, delayMs?: number): Promise<CampaignSendResult>;
    /**
     * Update campaign contact status
     */
    updateContactStatus(campaignId: string, contactId: string, status: MessageStatus, waMessageId?: string, failureReason?: string): Promise<void>;
    /**
     * Check if campaign is complete and update status
     */
    checkCampaignCompletion(campaignId: string): Promise<boolean>;
    /**
     * Mark message as read - ✅ FIXED VERSION
     */
    markAsRead(accountId: string, messageId: string): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    /**
     * Build template components with variables
     */
    private buildTemplateComponents;
    /**
     * Extract variable placeholders from template text
     */
    private extractVariablesFromText;
    /**
     * Extract and replace variables in text
     */
    private extractVariables;
    /**
     * Generate message preview for conversation list
     */
    private getMessagePreview;
    /**
     * Map string type to MessageType enum
     */
    private mapMessageType;
    /**
     * Get default WhatsApp account for organization
     */
    getDefaultAccount(organizationId: string): Promise<{
        phoneNumber: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
        createdAt: Date;
        updatedAt: Date;
        accessToken: string | null;
        webhookSecret: string | null;
        phoneNumberId: string;
        wabaId: string;
        displayName: string;
        qualityRating: string | null;
        tokenExpiresAt: Date | null;
        isDefault: boolean;
    } | null>;
    /**
     * Validate account has required permissions - ✅ FIXED VERSION
     */
    validateAccount(accountId: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
}
export declare const whatsappService: WhatsAppService;
export default whatsappService;
//# sourceMappingURL=whatsapp.service.d.ts.map