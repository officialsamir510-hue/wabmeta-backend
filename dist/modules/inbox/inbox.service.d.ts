import { Prisma } from '@prisma/client';
export declare class InboxService {
    /**
     * Get conversations with flexible query support
     */
    getConversations(organizationId: string, query?: any): Promise<{
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
                whatsappProfileName: string | null;
            };
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lastMessageAt: Date | null;
            contactId: string;
            phoneNumberId: string | null;
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
        meta: {
            page: any;
            limit: any;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Get single conversation
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
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Get messages for conversation
     */
    getMessages(organizationId: string, conversationId: string, query?: any): Promise<{
        messages: {
            type: import(".prisma/client").$Enums.MessageType;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            waMessageId: string | null;
            whatsappAccountId: string | null;
            templateId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            templateParams: Prisma.JsonValue | null;
            templateName: string | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            replyToMessageId: string | null;
            metadata: Prisma.JsonValue | null;
            statusUpdatedAt: Date | null;
            conversationId: string;
        }[];
        meta: {
            page: any;
            limit: any;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Mark conversation as read
     */
    markAsRead(organizationId: string, conversationId: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Archive/Unarchive conversation
     */
    archiveConversation(organizationId: string, conversationId: string, isArchived: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Assign conversation to user
     */
    assignConversation(organizationId: string, conversationId: string, userId: string | null): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Update conversation labels
     */
    updateLabels(organizationId: string, conversationId: string, labels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Get inbox stats
     */
    getStats(organizationId: string): Promise<{
        total: number;
        open: number;
        unread: number;
        archived: number;
    }>;
    /**
     * Get all labels
     */
    getAllLabels(organizationId: string): Promise<{
        label: string;
        count: number;
    }[]>;
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
                    whatsappProfileName: string | null;
                    whatsappProfileFetched: boolean;
                    lastProfileFetchAt: Date | null;
                    profileFetchAttempts: number;
                    customFields: Prisma.JsonValue;
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                lastMessageAt: Date | null;
                contactId: string;
                phoneNumberId: string | null;
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
            waMessageId: string | null;
            whatsappAccountId: string | null;
            templateId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            templateParams: Prisma.JsonValue | null;
            templateName: string | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            replyToMessageId: string | null;
            metadata: Prisma.JsonValue | null;
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
     * Bulk update conversations
     */
    bulkUpdate(organizationId: string, conversationIds: string[], updates: Partial<Prisma.ConversationUpdateInput>): Promise<{
        updated: number;
    }>;
    /**
     * Delete conversation
     */
    deleteConversation(organizationId: string, conversationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Update conversation
     */
    updateConversation(organizationId: string, conversationId: string, updates: Partial<Prisma.ConversationUpdateInput>): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
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
     * Send message
     */
    sendMessage(organizationId: string, userId: string, conversationId: string, input: any): Promise<any>;
}
export declare const inboxService: InboxService;
//# sourceMappingURL=inbox.service.d.ts.map