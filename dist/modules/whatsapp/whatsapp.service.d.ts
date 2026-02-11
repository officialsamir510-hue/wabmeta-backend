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
declare class WhatsAppService {
    /**
     * Send a text message
     */
    sendTextMessage(accountId: string, to: string, text: string, conversationId?: string): Promise<{
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
     * Send a template message
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
    sendMediaMessage(accountId: string, to: string, mediaType: 'image' | 'document' | 'video' | 'audio', mediaUrl: string, caption?: string, conversationId?: string): Promise<{
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
     * Core send message function
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
     * Send bulk campaign messages
     */
    sendCampaignMessages(campaignId: string, batchSize?: number, delayMs?: number): Promise<{
        sent: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Mark messages as read
     */
    markAsRead(accountId: string, messageId: string): Promise<{
        success: boolean;
    }>;
    private buildTemplateComponents;
    private extractVariablesFromText;
    private extractVariables;
    private getMessagePreview;
    private mapMessageType;
}
export declare const whatsappService: WhatsAppService;
export default whatsappService;
//# sourceMappingURL=whatsapp.service.d.ts.map