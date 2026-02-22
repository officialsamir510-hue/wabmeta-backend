"use strict";
// src/modules/inbox/inbox.service.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxService = exports.InboxService = void 0;
const database_1 = __importDefault(require("../../config/database"));
class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}
class InboxService {
    /**
     * Get conversations with flexible query support
     */
    async getConversations(organizationId, query = {}) {
        const { page = 1, limit = 50, search, isArchived, isRead, assignedTo, labels, sortBy = 'lastMessageAt', sortOrder = 'desc', } = query;
        const where = {
            organizationId,
        };
        // Filters
        if (isArchived !== undefined) {
            where.isArchived = isArchived;
        }
        if (isRead !== undefined) {
            where.isRead = isRead;
        }
        if (assignedTo) {
            where.assignedTo = assignedTo;
        }
        if (labels && labels.length > 0) {
            where.labels = { hasSome: Array.isArray(labels) ? labels : [labels] };
        }
        // Search
        if (search) {
            where.OR = [
                {
                    contact: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search } },
                            { email: { contains: search, mode: 'insensitive' } },
                        ],
                    },
                },
                { lastMessagePreview: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [conversations, total] = await Promise.all([
            database_1.default.conversation.findMany({
                where,
                include: {
                    contact: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            avatar: true,
                            tags: true,
                            whatsappProfileName: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            database_1.default.conversation.count({ where }),
        ]);
        // Transform conversations
        const transformed = conversations.map((conv) => ({
            ...conv,
            contact: {
                ...conv.contact,
                name: conv.contact.whatsappProfileName ||
                    (conv.contact.firstName
                        ? `${conv.contact.firstName} ${conv.contact.lastName || ''}`.trim()
                        : conv.contact.phone),
            },
        }));
        return {
            conversations: transformed,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get single conversation
     */
    async getConversationById(organizationId, conversationId) {
        const conversation = await database_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                organizationId,
            },
            include: {
                contact: true,
            },
        });
        if (!conversation) {
            throw new AppError('Conversation not found', 404);
        }
        return conversation;
    }
    /**
     * Get messages for conversation
     */
    async getMessages(organizationId, conversationId, query = {}) {
        // Verify conversation belongs to organization
        await this.getConversationById(organizationId, conversationId);
        const { page = 1, limit = 100, before, after } = query;
        const where = {
            conversationId,
        };
        if (before) {
            where.createdAt = { lt: new Date(before) };
        }
        if (after) {
            where.createdAt = { ...where.createdAt, gt: new Date(after) };
        }
        const [messages, total] = await Promise.all([
            database_1.default.message.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            database_1.default.message.count({ where }),
        ]);
        return {
            messages,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Mark conversation as read
     */
    async markAsRead(organizationId, conversationId) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: {
                unreadCount: 0,
                isRead: true,
            },
        });
        return conversation;
    }
    /**
     * Archive/Unarchive conversation
     */
    async archiveConversation(organizationId, conversationId, isArchived) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { isArchived },
        });
        return conversation;
    }
    /**
     * Assign conversation to user
     */
    async assignConversation(organizationId, conversationId, userId) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { assignedTo: userId },
        });
        return conversation;
    }
    /**
     * Update conversation labels
     */
    async updateLabels(organizationId, conversationId, labels) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { labels },
        });
        return conversation;
    }
    /**
     * Add labels to conversation
     */
    async addLabels(organizationId, conversationId, newLabels) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        const updatedLabels = [...new Set([...conversation.labels, ...newLabels])];
        return this.updateLabels(organizationId, conversationId, updatedLabels);
    }
    /**
     * Remove label from conversation
     */
    async removeLabel(organizationId, conversationId, label) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        const updatedLabels = conversation.labels.filter((l) => l !== label);
        return this.updateLabels(organizationId, conversationId, updatedLabels);
    }
    /**
     * Get inbox stats
     */
    async getStats(organizationId) {
        const baseWhere = { organizationId };
        const [total, open, unread, archived] = await Promise.all([
            database_1.default.conversation.count({ where: baseWhere }),
            database_1.default.conversation.count({
                where: { ...baseWhere, isWindowOpen: true, isArchived: false },
            }),
            database_1.default.conversation.count({
                where: { ...baseWhere, unreadCount: { gt: 0 } },
            }),
            database_1.default.conversation.count({
                where: { ...baseWhere, isArchived: true },
            }),
        ]);
        return { total, open, unread, archived };
    }
    /**
     * Get all labels
     */
    async getAllLabels(organizationId) {
        const conversations = await database_1.default.conversation.findMany({
            where: { organizationId },
            select: { labels: true },
        });
        const allLabels = conversations.flatMap((c) => c.labels);
        const uniqueLabels = [...new Set(allLabels)];
        return uniqueLabels.map((label) => ({
            label,
            count: allLabels.filter((l) => l === label).length,
        }));
    }
    /**
     * Search messages
     */
    async searchMessages(organizationId, query, page = 1, limit = 20) {
        const where = {
            conversation: {
                organizationId,
            },
            content: {
                contains: query,
                mode: 'insensitive',
            },
        };
        const [messages, total] = await Promise.all([
            database_1.default.message.findMany({
                where,
                include: {
                    conversation: {
                        include: {
                            contact: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            database_1.default.message.count({ where }),
        ]);
        return {
            messages,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Bulk update conversations
     */
    async bulkUpdate(organizationId, conversationIds, updates) {
        const result = await database_1.default.conversation.updateMany({
            where: {
                id: { in: conversationIds },
                organizationId,
            },
            data: updates,
        });
        return { updated: result.count };
    }
    /**
     * Delete conversation
     */
    async deleteConversation(organizationId, conversationId) {
        await this.getConversationById(organizationId, conversationId);
        await database_1.default.conversation.delete({
            where: { id: conversationId },
        });
        return { success: true, message: 'Conversation deleted' };
    }
    /**
     * Update conversation
     */
    async updateConversation(organizationId, conversationId, updates) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: updates,
        });
        return conversation;
    }
    /**
     * Get or create conversation
     */
    async getOrCreateConversation(organizationId, contactId) {
        let conversation = await database_1.default.conversation.findUnique({
            where: {
                organizationId_contactId: {
                    organizationId,
                    contactId,
                },
            },
            include: {
                contact: true,
            },
        });
        if (!conversation) {
            conversation = await database_1.default.conversation.create({
                data: {
                    organizationId,
                    contactId,
                    isWindowOpen: true,
                    unreadCount: 0,
                },
                include: {
                    contact: true,
                },
            });
        }
        return conversation;
    }
    /**
     * Send message
     */
    async sendMessage(organizationId, userId, conversationId, input) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        // Create message in database
        const message = (await database_1.default.message.create({
            data: {
                conversationId,
                whatsappAccountId: conversation.phoneNumberId || 'default',
                direction: 'OUTBOUND',
                type: input.type || 'TEXT',
                content: input.content,
                mediaUrl: input.mediaUrl,
                status: 'PENDING',
            },
        }));
        // Update conversation
        await database_1.default.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: input.content?.substring(0, 100),
            },
        });
        return message;
    }
}
exports.InboxService = InboxService;
exports.inboxService = new InboxService();
//# sourceMappingURL=inbox.service.js.map