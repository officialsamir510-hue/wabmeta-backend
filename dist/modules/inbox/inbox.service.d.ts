import { Prisma } from '@prisma/client';
import { ConversationsQueryInput, MessagesQueryInput, SendMessageInput, UpdateConversationInput } from './inbox.types';
type ConversationFilter = 'all' | 'unread' | 'archived' | 'open';
declare class InboxService {
    /**
     * Get conversations for an organization
     * Supports both old 3-argument style and new 2-argument style
     */
    getConversations(organizationId: string, accountIdOrQuery?: string | ConversationsQueryInput, options?: {
        filter?: ConversationFilter;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        conversations: {
            contact: {
                name: string;
                email: string | null;
                tags: string[];
                id: string;
                firstName: string | null;
                lastName: string | null;
                phone: string;
                avatar: string | null;
            };
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            contactId: string;
            phoneNumberId: string | null;
            lastMessageAt: Date | null;
            lastMessagePreview: string | null;
            lastCustomerMessageAt: Date | null;
            windowExpiresAt: Date | null;
            isWindowOpen: boolean;
            lastBotMessageAt: Date | null;
            isArchived: boolean;
            isRead: boolean;
            unreadCount: number;
            assignedTo: string | null;
            labels: string[];
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Get single conversation by ID
     */
    getConversation(conversationId: string, organizationId?: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
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
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Get conversation by ID (alias for controller compatibility)
     */
    getConversationById(organizationId: string, conversationId: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
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
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Get messages for a conversation
     * Supports both 2-argument and 3-argument styles
     */
    getMessages(conversationIdOrOrgId: string, optionsOrConversationId?: string | MessagesQueryInput | {
        before?: string;
        limit?: number;
    }, query?: MessagesQueryInput): Promise<{
        messages: {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            metadata: Prisma.JsonValue | null;
            whatsappAccountId: string | null;
            waMessageId: string | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            conversationId: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Mark conversation as read
     * Supports both 1-argument and 2-argument styles
     */
    markAsRead(conversationIdOrOrgId: string, userIdOrConversationId?: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Update archive status
     * For routes.ts compatibility
     */
    updateArchiveStatus(conversationId: string, isArchived: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Archive conversation
     * For controller.ts compatibility
     */
    archiveConversation(organizationId: string, conversationId: string, isArchived: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Update labels
     * Supports both 2-argument and 3-argument styles
     */
    updateLabels(conversationIdOrOrgId: string, labelsOrConversationId: string[] | string, labels?: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Add labels to conversation
     */
    addLabels(organizationId: string, conversationId: string, newLabels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Remove label from conversation
     */
    removeLabel(organizationId: string, conversationId: string, label: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Assign conversation
     * Supports both 2-argument and 3-argument styles
     */
    assignConversation(conversationIdOrOrgId: string, userIdOrConversationId: string | null, userId?: string | null): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Update conversation
     */
    updateConversation(organizationId: string, conversationId: string, input: UpdateConversationInput): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Delete conversation
     */
    deleteConversation(organizationId: string, conversationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Bulk update conversations
     */
    bulkUpdate(organizationId: string, conversationIds: string[], updates: Partial<UpdateConversationInput>): Promise<{
        updated: number;
    }>;
    /**
     * Search messages
     */
    searchMessages(organizationId: string, query: string, page?: number, limit?: number): Promise<{
        messages: ({
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    tags: string[];
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
                    customFields: Prisma.JsonValue;
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                contactId: string;
                phoneNumberId: string | null;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
                lastBotMessageAt: Date | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                assignedTo: string | null;
                labels: string[];
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            metadata: Prisma.JsonValue | null;
            whatsappAccountId: string | null;
            waMessageId: string | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateName: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            conversationId: string;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Get conversation stats
     * Supports both 1-argument and 2-argument styles
     */
    getStats(organizationId: string, accountIdOrUserId?: string): Promise<{
        total: number;
        open: number;
        unread: number;
        archived: number;
    }>;
    /**
     * Get all labels for organization
     */
    getAllLabels(organizationId: string): Promise<{
        label: string;
        count: number;
    }[]>;
    /**
     * Get or create conversation
     */
    getOrCreateConversation(organizationId: string, contactId: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
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
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Send message (placeholder - implement with WhatsApp API)
     */
    sendMessage(organizationId: string, userId: string, conversationId: string, input: SendMessageInput): Promise<{
        type: import(".prisma/client").$Enums.MessageType;
        id: string;
        status: import(".prisma/client").$Enums.MessageStatus;
        createdAt: Date;
        updatedAt: Date;
        metadata: Prisma.JsonValue | null;
        whatsappAccountId: string | null;
        waMessageId: string | null;
        wamId: string | null;
        direction: import(".prisma/client").$Enums.MessageDirection;
        content: string | null;
        mediaUrl: string | null;
        mediaType: string | null;
        mediaMimeType: string | null;
        templateId: string | null;
        templateName: string | null;
        templateParams: Prisma.JsonValue | null;
        sentAt: Date | null;
        deliveredAt: Date | null;
        readAt: Date | null;
        failedAt: Date | null;
        failureReason: string | null;
        replyToMessageId: string | null;
        retryCount: number;
        statusUpdatedAt: Date | null;
        conversationId: string;
    }>;
}
export declare const inboxService: InboxService;
export default inboxService;
//# sourceMappingURL=inbox.service.d.ts.map