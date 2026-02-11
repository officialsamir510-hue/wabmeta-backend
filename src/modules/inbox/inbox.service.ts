// src/modules/inbox/inbox.service.ts

import { PrismaClient, ConversationStatus } from '@prisma/client';

const prisma = new PrismaClient();

class InboxService {
  /**
   * Get conversations for an account
   */
  async getConversations(
    organizationId: string,
    accountId: string,
    options: {
      status?: ConversationStatus;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, search, page = 1, limit = 50 } = options;

    const where: any = {
      organizationId,
      whatsappAccountId: accountId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { profileName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              name: true,
              profileName: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    options: {
      before?: string;
      limit?: number;
    } = {}
  ) {
    const { before, limit = 50 } = options;

    const where: any = { conversationId };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return { messages };
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string, userId: string) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    return { success: true };
  }

  /**
   * Update conversation status
   */
  async updateStatus(conversationId: string, status: ConversationStatus) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    return conversation;
  }

  /**
   * Assign conversation to user
   */
  async assignConversation(conversationId: string, userId: string | null) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: userId },
    });

    return conversation;
  }

  /**
   * Get conversation stats
   */
  async getStats(organizationId: string, accountId: string) {
    const [total, open, pending, unread] = await Promise.all([
      prisma.conversation.count({
        where: { organizationId, whatsappAccountId: accountId },
      }),
      prisma.conversation.count({
        where: { organizationId, whatsappAccountId: accountId, status: 'OPEN' },
      }),
      prisma.conversation.count({
        where: { organizationId, whatsappAccountId: accountId, status: 'PENDING' },
      }),
      prisma.conversation.count({
        where: {
          organizationId,
          whatsappAccountId: accountId,
          unreadCount: { gt: 0 },
        },
      }),
    ]);

    return { total, open, pending, unread };
  }
}

export const inboxService = new InboxService();
export default inboxService;