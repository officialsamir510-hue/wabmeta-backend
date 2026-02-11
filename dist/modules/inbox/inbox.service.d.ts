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
                id: string;
                firstName: string | null;
                lastName: string | null;
                phone: string;
                avatar: string | null;
                tags: string[];
            };
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
    }>;
    /**
     * Get conversation by ID (alias for controller compatibility)
     */
    getConversationById(organizationId: string, conversationId: string): Promise<{
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
            customFields: Prisma.JsonValue;
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
            waMessageId: string | null;
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
            metadata: Prisma.JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
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
    }>;
    /**
     * Add labels to conversation
     */
    addLabels(organizationId: string, conversationId: string, newLabels: string[]): Promise<{
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
    }>;
    /**
     * Remove label from conversation
     */
    removeLabel(organizationId: string, conversationId: string, label: string): Promise<{
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
    }>;
    /**
     * Update conversation
     */
    updateConversation(organizationId: string, conversationId: string, input: UpdateConversationInput): Promise<{
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
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: Prisma.JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            wamId: string | null;
            conversationId: string;
            whatsappAccountId: string | null;
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
        waMessageId: string | null;
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
        metadata: Prisma.JsonValue | null;
        retryCount: number;
        statusUpdatedAt: Date | null;
        wamId: string | null;
        conversationId: string;
        whatsappAccountId: string | null;
    }>;
}
export declare const inboxService: InboxService;
export default inboxService;
//# sourceMappingURL=inbox.service.d.ts.map