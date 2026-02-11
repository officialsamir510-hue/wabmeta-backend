import { MessageType } from '@prisma/client';
export interface ConversationsQueryInput {
    page?: number;
    limit?: number;
    search?: string;
    isArchived?: boolean;
    isRead?: boolean;
    assignedTo?: string;
    labels?: string[];
    sortBy?: 'lastMessageAt' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}
export interface MessagesQueryInput {
    page?: number;
    limit?: number;
    before?: string;
    after?: string;
}
export interface SendMessageInput {
    type: MessageType;
    content?: string;
    mediaUrl?: string;
}
export interface UpdateConversationInput {
    isArchived?: boolean;
    isRead?: boolean;
    assignedTo?: string | null;
    labels?: string[];
}
export interface ActivityLogResponse {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    userId: string | null;
    userEmail: string;
    organizationId: string | null;
    organizationName: string;
    metadata: any;
    ipAddress: string | null;
    createdAt: Date;
}
//# sourceMappingURL=inbox.types.d.ts.map