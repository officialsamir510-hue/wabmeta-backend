// src/modules/inbox/inbox.service.ts - COMPLETE FIXED

import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '../../config/database';

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class InboxService {
  /**
   * Get conversations with flexible query support
   */
  async getConversations(organizationId: string, query: any = {}) {
    const {
      page = 1,
      limit = 50,
      search,
      isArchived,
      isRead,
      assignedTo,
      labels,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ConversationWhereInput = {
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
      prisma.conversation.findMany({
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
      prisma.conversation.count({ where }),
    ]);

    // Transform conversations
    const transformed = conversations.map((conv) => ({
      ...conv,
      contact: {
        ...conv.contact,
        name:
          conv.contact.whatsappProfileName ||
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
  async getConversationById(organizationId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
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
  async getMessages(organizationId: string, conversationId: string, query: any = {}) {
    // Verify conversation belongs to organization
    await this.getConversationById(organizationId, conversationId);

    const { page = 1, limit = 100, before, after } = query;

    const where: Prisma.MessageWhereInput = {
      conversationId,
    };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    if (after) {
      where.createdAt = { ...(where.createdAt as any), gt: new Date(after) };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
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
  async markAsRead(organizationId: string, conversationId: string) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
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
  async archiveConversation(
    organizationId: string,
    conversationId: string,
    isArchived: boolean
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived },
    });

    return conversation;
  }

  /**
   * Assign conversation to user
   */
  async assignConversation(
    organizationId: string,
    conversationId: string,
    userId: string | null
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: userId },
    });

    return conversation;
  }

  /**
   * Update conversation labels
   */
  async updateLabels(organizationId: string, conversationId: string, labels: string[]) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels },
    });

    return conversation;
  }

  /**
   * Add labels to conversation
   */
  async addLabels(organizationId: string, conversationId: string, newLabels: string[]) {
    const conversation = await this.getConversationById(organizationId, conversationId);
    const updatedLabels = [...new Set([...conversation.labels, ...newLabels])];

    return this.updateLabels(organizationId, conversationId, updatedLabels);
  }

  /**
   * Remove label from conversation
   */
  async removeLabel(organizationId: string, conversationId: string, label: string) {
    const conversation = await this.getConversationById(organizationId, conversationId);
    const updatedLabels = conversation.labels.filter((l) => l !== label);

    return this.updateLabels(organizationId, conversationId, updatedLabels);
  }

  /**
   * Get inbox stats
   */
  async getStats(organizationId: string) {
    const baseWhere: Prisma.ConversationWhereInput = { organizationId };

    const [total, open, unread, archived] = await Promise.all([
      prisma.conversation.count({ where: baseWhere }),
      prisma.conversation.count({
        where: { ...baseWhere, isWindowOpen: true, isArchived: false },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, unreadCount: { gt: 0 } },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, isArchived: true },
      }),
    ]);

    return { total, open, unread, archived };
  }

  /**
   * Get all labels
   */
  async getAllLabels(organizationId: string) {
    const conversations = await prisma.conversation.findMany({
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
  async searchMessages(
    organizationId: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ) {
    const where: Prisma.MessageWhereInput = {
      conversation: {
        organizationId,
      },
      content: {
        contains: query,
        mode: 'insensitive',
      },
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
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
      prisma.message.count({ where }),
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
  async bulkUpdate(
    organizationId: string,
    conversationIds: string[],
    updates: Partial<Prisma.ConversationUpdateInput>
  ) {
    const result = await prisma.conversation.updateMany({
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
  async deleteConversation(organizationId: string, conversationId: string) {
    await this.getConversationById(organizationId, conversationId);

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true, message: 'Conversation deleted' };
  }

  /**
   * Update conversation
   */
  async updateConversation(
    organizationId: string,
    conversationId: string,
    updates: Partial<Prisma.ConversationUpdateInput>
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: updates,
    });

    return conversation;
  }

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(organizationId: string, contactId: string) {
    let conversation = await prisma.conversation.findUnique({
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
      conversation = await prisma.conversation.create({
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
}

export const inboxService = new InboxService();
export default inboxService;