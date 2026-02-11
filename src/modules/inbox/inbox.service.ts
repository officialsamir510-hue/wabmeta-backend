// src/modules/inbox/inbox.service.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define conversation filter type since ConversationStatus doesn't exist in schema
type ConversationFilter = 'all' | 'unread' | 'archived' | 'open';

class InboxService {
  /**
   * Get conversations for an account
   */
  async getConversations(
    organizationId: string,
    accountId?: string,
    options: {
      filter?: ConversationFilter;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { filter, search, page = 1, limit = 50 } = options;

    const where: any = {
      organizationId,
    };

    // Use phoneNumberId if accountId is provided
    if (accountId) {
      where.phoneNumberId = accountId;
    }

    // Apply filters based on available fields
    if (filter === 'unread') {
      where.unreadCount = { gt: 0 };
    } else if (filter === 'archived') {
      where.isArchived = true;
    } else if (filter === 'open') {
      where.isWindowOpen = true;
      where.isArchived = false;
    }

    if (search) {
      where.contact = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
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
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              tags: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Transform conversations to include computed name
    const transformedConversations = conversations.map(conv => ({
      ...conv,
      contact: {
        ...conv.contact,
        name: conv.contact.firstName 
          ? `${conv.contact.firstName} ${conv.contact.lastName || ''}`.trim()
          : conv.contact.phone,
      },
    }));

    return {
      conversations: transformedConversations,
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
      data: { 
        unreadCount: 0,
        isRead: true,
      },
    });

    return { success: true };
  }

  /**
   * Archive/Unarchive conversation
   */
  async updateArchiveStatus(conversationId: string, isArchived: boolean) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived },
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
   * Add/Remove labels to conversation
   */
  async updateLabels(conversationId: string, labels: string[]) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels },
    });

    return conversation;
  }

  /**
   * Get conversation stats
   */
  async getStats(organizationId: string, accountId?: string) {
    const baseWhere: any = { organizationId };
    
    if (accountId) {
      baseWhere.phoneNumberId = accountId;
    }

    const [total, open, unread, archived] = await Promise.all([
      prisma.conversation.count({
        where: baseWhere,
      }),
      prisma.conversation.count({
        where: { 
          ...baseWhere, 
          isWindowOpen: true,
          isArchived: false,
        },
      }),
      prisma.conversation.count({
        where: { 
          ...baseWhere, 
          unreadCount: { gt: 0 },
        },
      }),
      prisma.conversation.count({
        where: { 
          ...baseWhere, 
          isArchived: true,
        },
      }),
    ]);

    return { total, open, unread, archived };
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(conversationId: string, organizationId: string) {
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
      throw new Error('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(
    organizationId: string,
    contactId: string,
    phoneNumberId?: string
  ) {
    // Try to find existing conversation
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
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId,
          phoneNumberId,
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