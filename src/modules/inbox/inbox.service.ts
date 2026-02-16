// src/modules/inbox/inbox.service.ts

import { PrismaClient, Prisma, MessageType } from '@prisma/client';
import {
  ConversationsQueryInput,
  MessagesQueryInput,
  SendMessageInput,
  UpdateConversationInput,
} from './inbox.types';

const prisma = new PrismaClient();

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Define conversation filter type
type ConversationFilter = 'all' | 'unread' | 'archived' | 'open';

class InboxService {
  /**
   * Get conversations for an organization
   * Supports both old 3-argument style and new 2-argument style
   */
  async getConversations(
    organizationId: string,
    accountIdOrQuery?: string | ConversationsQueryInput,
    options?: {
      filter?: ConversationFilter;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    // Handle both calling patterns
    let accountId: string | undefined;
    let filter: ConversationFilter | undefined;
    let search: string | undefined;
    let page = 1;
    let limit = 50;
    let isArchived: boolean | undefined;
    let isRead: boolean | undefined;
    let assignedTo: string | undefined;
    let labels: string[] | undefined;
    let sortBy: string = 'lastMessageAt';
    let sortOrder: 'asc' | 'desc' = 'desc';

    // Check if second argument is ConversationsQueryInput or accountId string
    if (typeof accountIdOrQuery === 'object' && accountIdOrQuery !== null) {
      // New style: getConversations(orgId, query)
      const query = accountIdOrQuery as ConversationsQueryInput;
      page = query.page || 1;
      limit = query.limit || 50;
      search = query.search;
      isArchived = query.isArchived;
      isRead = query.isRead;
      assignedTo = query.assignedTo;
      labels = query.labels;
      sortBy = query.sortBy || 'lastMessageAt';
      sortOrder = query.sortOrder || 'desc';
    } else {
      // Old style: getConversations(orgId, accountId, options)
      accountId = accountIdOrQuery as string | undefined;
      if (options) {
        filter = options.filter;
        search = options.search;
        page = options.page || 1;
        limit = options.limit || 50;
      }
    }

    const where: Prisma.ConversationWhereInput = {
      organizationId,
    };

    // Apply phoneNumberId filter if accountId provided
    if (accountId) {
      where.phoneNumberId = accountId;
    }

    // Apply filters based on filter string (old style)
    if (filter === 'unread') {
      where.unreadCount = { gt: 0 };
    } else if (filter === 'archived') {
      where.isArchived = true;
    } else if (filter === 'open') {
      where.isWindowOpen = true;
      where.isArchived = false;
    }

    // Apply filters (new style)
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
      where.labels = {
        hasSome: labels,
      };
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
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Transform conversations to include computed name
    const transformedConversations = conversations.map((conv) => ({
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
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(conversationId: string, organizationId?: string) {
    const where: Prisma.ConversationWhereInput = {
      id: conversationId,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const conversation = await prisma.conversation.findFirst({
      where,
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
   * Get conversation by ID (alias for controller compatibility)
   */
  async getConversationById(organizationId: string, conversationId: string) {
    return this.getConversation(conversationId, organizationId);
  }

  /**
   * Get messages for a conversation
   * Supports both 2-argument and 3-argument styles
   */
  async getMessages(
    conversationIdOrOrgId: string,
    optionsOrConversationId?:
      | string
      | MessagesQueryInput
      | { before?: string; limit?: number },
    query?: MessagesQueryInput
  ) {
    let conversationId: string;
    let organizationId: string | undefined;
    let before: string | undefined;
    let after: string | undefined;
    let page = 1;
    let limit = 50;

    // Detect calling pattern
    if (
      typeof optionsOrConversationId === 'string' ||
      optionsOrConversationId === undefined
    ) {
      if (query) {
        // 3-argument style: getMessages(orgId, conversationId, query)
        organizationId = conversationIdOrOrgId;
        conversationId = optionsOrConversationId as string;
        page = query.page || 1;
        limit = query.limit || 50;
        before = query.before;
        after = query.after;
      } else if (typeof optionsOrConversationId === 'string') {
        // Could be 2-argument with conversationId as second
        // Try to detect if first arg is orgId or conversationId
        conversationId = optionsOrConversationId;
        organizationId = conversationIdOrOrgId;
      } else {
        // Single argument - conversationId only
        conversationId = conversationIdOrOrgId;
      }
    } else {
      // 2-argument style: getMessages(conversationId, options)
      conversationId = conversationIdOrOrgId;
      const options = optionsOrConversationId as { before?: string; limit?: number };
      before = options.before;
      limit = options.limit || 50;
    }

    // Verify conversation exists if organizationId provided
    if (organizationId) {
      await this.getConversation(conversationId, organizationId);
    }

    const where: Prisma.MessageWhereInput = { conversationId };

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
   * Supports both 1-argument and 2-argument styles
   */
  async markAsRead(conversationIdOrOrgId: string, userIdOrConversationId?: string) {
    let conversationId: string;

    if (userIdOrConversationId && userIdOrConversationId.length > 10) {
      // 2-argument style: markAsRead(orgId, conversationId)
      conversationId = userIdOrConversationId;
    } else {
      // 1-argument style: markAsRead(conversationId)
      conversationId = conversationIdOrOrgId;
    }

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
   * Update archive status
   * For routes.ts compatibility
   */
  async updateArchiveStatus(conversationId: string, isArchived: boolean) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived },
    });

    return conversation;
  }

  /**
   * Archive conversation
   * For controller.ts compatibility
   */
  async archiveConversation(
    organizationId: string,
    conversationId: string,
    isArchived: boolean
  ) {
    await this.getConversation(conversationId, organizationId);
    return this.updateArchiveStatus(conversationId, isArchived);
  }

  /**
   * Update labels
   * Supports both 2-argument and 3-argument styles
   */
  async updateLabels(
    conversationIdOrOrgId: string,
    labelsOrConversationId: string[] | string,
    labels?: string[]
  ) {
    let conversationId: string;
    let newLabels: string[];

    if (Array.isArray(labelsOrConversationId)) {
      // 2-argument style: updateLabels(conversationId, labels)
      conversationId = conversationIdOrOrgId;
      newLabels = labelsOrConversationId;
    } else {
      // 3-argument style: updateLabels(orgId, conversationId, labels)
      conversationId = labelsOrConversationId;
      newLabels = labels || [];
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels: newLabels },
    });

    return conversation;
  }

  /**
   * Add labels to conversation
   */
  async addLabels(
    organizationId: string,
    conversationId: string,
    newLabels: string[]
  ) {
    const conversation = await this.getConversation(conversationId, organizationId);
    const updatedLabels = [...new Set([...conversation.labels, ...newLabels])];
    return this.updateLabels(conversationId, updatedLabels);
  }

  /**
   * Remove label from conversation
   */
  async removeLabel(organizationId: string, conversationId: string, label: string) {
    const conversation = await this.getConversation(conversationId, organizationId);
    const updatedLabels = conversation.labels.filter((l) => l !== label);
    return this.updateLabels(conversationId, updatedLabels);
  }

  /**
   * Assign conversation
   * Supports both 2-argument and 3-argument styles
   */
  async assignConversation(
    conversationIdOrOrgId: string,
    userIdOrConversationId: string | null,
    userId?: string | null
  ) {
    let conversationId: string;
    let assignUserId: string | null;

    if (userId !== undefined) {
      // 3-argument style: assignConversation(orgId, conversationId, userId)
      conversationId = userIdOrConversationId as string;
      assignUserId = userId;
    } else {
      // 2-argument style: assignConversation(conversationId, userId)
      conversationId = conversationIdOrOrgId;
      assignUserId = userIdOrConversationId;
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: assignUserId },
    });

    return conversation;
  }

  /**
   * Update conversation
   */
  async updateConversation(
    organizationId: string,
    conversationId: string,
    input: UpdateConversationInput
  ) {
    await this.getConversation(conversationId, organizationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: input,
    });

    return conversation;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(organizationId: string, conversationId: string) {
    await this.getConversation(conversationId, organizationId);

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true, message: 'Conversation deleted' };
  }

  /**
   * Bulk update conversations
   */
  async bulkUpdate(
    organizationId: string,
    conversationIds: string[],
    updates: Partial<UpdateConversationInput>
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
   * Get conversation stats
   * Supports both 1-argument and 2-argument styles
   */
  async getStats(organizationId: string, accountIdOrUserId?: string) {
    const baseWhere: Prisma.ConversationWhereInput = { organizationId };

    // If it looks like a phone number ID, filter by it
    if (accountIdOrUserId && accountIdOrUserId.length < 30) {
      baseWhere.assignedTo = accountIdOrUserId;
    } else if (accountIdOrUserId) {
      baseWhere.phoneNumberId = accountIdOrUserId;
    }

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
   * Get all labels for organization
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
      // Get default phone number
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: {
          metaConnection: {
            organizationId,
            status: 'CONNECTED',
          },
          isActive: true,
          isPrimary: true,
        } as any,
      });

      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId,
          phoneNumberId: phoneNumber?.id,
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
   * Send message (placeholder - implement with WhatsApp API)
   */
  async sendMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    input: SendMessageInput
  ) {
    const conversation = await this.getConversation(conversationId, organizationId);

    // Create message in database
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: input.type || 'TEXT',
        content: input.content,
        mediaUrl: input.mediaUrl,
        status: 'PENDING',
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.content?.substring(0, 100),
      },
    });

    // TODO: Send via WhatsApp API here
    // await whatsappService.sendMessage(...)

    return message;
  }
}

export const inboxService = new InboxService();
export default inboxService;