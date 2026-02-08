// src/modules/inbox/inbox.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { MessageType, MessageDirection, MessageStatus, Prisma } from '@prisma/client';
import { whatsappService } from '../whatsapp/whatsapp.service';
import {
  ConversationsQueryInput,
  MessagesQueryInput,
  SendMessageInput,
  UpdateConversationInput,
  ConversationResponse,
  ConversationDetailResponse,
  MessageResponse,
  ConversationsListResponse,
  InboxStats,
} from './inbox.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Emit Socket.IO events
 */
const emitSocketEvent = (event: string, room: string, data: any) => {
  try {
    const io = (global as any).io;
    if (io) {
      io.to(room).emit(event, data);
      console.log(`📡 Emitted ${event} to room ${room}`);
    }
  } catch (error) {
    console.error('Error emitting socket event:', error);
  }
};

const formatContact = (contact: any) => ({
  id: contact.id,
  phone: contact.phone,
  fullPhone: `${contact.countryCode}${contact.phone}`,
  firstName: contact.firstName,
  lastName: contact.lastName,
  fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone,
  avatar: contact.avatar,
  email: contact.email,
  tags: contact.tags || [],
});

const formatMessage = (message: any): MessageResponse => ({
  id: message.id,
  wamId: message.wamId,
  waMessageId: message.waMessageId,
  direction: message.direction,
  type: message.type,
  content: message.content,
  mediaUrl: message.mediaUrl,
  mediaType: message.mediaType,
  mediaMimeType: message.mediaMimeType,
  templateName: message.templateName,
  status: message.status,
  sentAt: message.sentAt,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  failedAt: message.failedAt,
  failureReason: message.failureReason,
  replyToMessageId: message.replyToMessageId,
  replyToMessage: message.replyToMessage ? formatMessage(message.replyToMessage) : null,
  createdAt: message.createdAt,
});

const formatConversation = (conversation: any): ConversationResponse => ({
  id: conversation.id,
  contact: formatContact(conversation.contact),
  lastMessageAt: conversation.lastMessageAt,
  lastMessagePreview: conversation.lastMessagePreview,
  isArchived: conversation.isArchived,
  isRead: conversation.isRead,
  unreadCount: conversation.unreadCount,
  status: conversation.status,
  assignedTo: conversation.assignedTo,
  assignedUser: conversation.assignedUser ? {
    id: conversation.assignedUser.id,
    firstName: conversation.assignedUser.firstName,
    lastName: conversation.assignedUser.lastName,
    avatar: conversation.assignedUser.avatar,
  } : undefined,
  labels: conversation.labels || [],
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

// ============================================
// INBOX SERVICE CLASS
// ============================================

export class InboxService {
  // ==========================================
  // GET CONVERSATIONS
  // ==========================================
  async getConversations(
    organizationId: string,
    query: ConversationsQueryInput
  ): Promise<ConversationsListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      isArchived,
      isRead,
      assignedTo,
      labels,
      status,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ConversationWhereInput = {
      organizationId,
    };

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    }

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (status) {
      where.status = status;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
    }

    if (labels && labels.length > 0) {
      where.labels = { hasSome: labels };
    }

    if (search) {
      where.OR = [
        { contact: { phone: { contains: search, mode: 'insensitive' } } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
        { lastMessagePreview: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute query
    const [conversations, total, unreadTotal] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          contact: true,
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.count({
        where: {
          organizationId,
          isRead: false,
          isArchived: false,
        },
      }),
    ]);

    return {
      conversations: conversations.map(formatConversation),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadTotal,
      },
    };
  }

  // ==========================================
  // GET CONVERSATION BY ID
  // ==========================================
  async getConversationById(
    organizationId: string,
    conversationId: string
  ): Promise<ConversationDetailResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            replyToMessage: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });

    return {
      ...formatConversation(conversation),
      messages: conversation.messages.reverse().map(formatMessage),
      totalMessages,
    };
  }

  // ==========================================
  // GET MESSAGES
  // ==========================================
  async getMessages(
    organizationId: string,
    conversationId: string,
    query: MessagesQueryInput
  ): Promise<{ messages: MessageResponse[]; hasMore: boolean }> {
    const { page = 1, limit = 50, before, after } = query;

    // Verify conversation belongs to organization
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const where: Prisma.MessageWhereInput = {
      conversationId,
    };

    // Cursor pagination
    if (before) {
      const beforeMessage = await prisma.message.findUnique({ where: { id: before } });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    if (after) {
      const afterMessage = await prisma.message.findUnique({ where: { id: after } });
      if (afterMessage) {
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        replyToMessage: true,
      },
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return {
      messages: messages.reverse().map(formatMessage),
      hasMore,
    };
  }

  // ==========================================
  // SEND MESSAGE
  // ==========================================
  async sendMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    input: SendMessageInput
  ): Promise<MessageResponse> {
    const { type, content, mediaUrl, mediaType, filename, replyToMessageId, interactive } = input;

    // Get conversation with contact
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Get default WhatsApp account
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        status: 'CONNECTED',
        isDefault: true,
      },
    });

    if (!waAccount) {
      throw new AppError('No connected WhatsApp account found', 400);
    }

    const toPhone = `${conversation.contact.countryCode}${conversation.contact.phone}`;
    let waMessageId: string | undefined;
    let sendError: string | undefined;

    // Send message via WhatsApp
    try {
      let result;

      switch (type) {
        case 'text':
          if (!content) throw new AppError('Content is required for text messages', 400);
          result = await whatsappService.sendTextMessage(
            organizationId,
            waAccount.id,
            toPhone,
            content,
            replyToMessageId
          );
          break;

        case 'image':
        case 'video':
        case 'audio':
        case 'document':
          if (!mediaUrl) throw new AppError('Media URL is required', 400);
          result = await whatsappService.sendMediaMessage(
            organizationId,
            waAccount.id,
            toPhone,
            type,
            mediaUrl,
            content,
            filename
          );
          break;

        case 'interactive':
          if (!interactive || !content) throw new AppError('Interactive config and body text required', 400);
          result = await whatsappService.sendInteractiveMessage(
            organizationId,
            waAccount.id,
            toPhone,
            interactive.type,
            content,
            {
              buttons: interactive.buttons,
              sections: interactive.sections,
              buttonText: interactive.buttonText,
            }
          );
          break;

        default:
          throw new AppError(`Unsupported message type: ${type}`, 400);
      }

      if (result.success) {
        waMessageId = result.messageId;
      } else {
        sendError = result.error;
      }
    } catch (error: any) {
      sendError = error.message;
    }

    // Save message to database
    const messageType = type.toUpperCase() as MessageType;
    const message = await prisma.message.create({
      data: {
        conversationId,
        whatsappAccountId: waAccount.id,
        waMessageId,
        direction: 'OUTBOUND',
        type: messageType,
        content,
        mediaUrl,
        mediaType,
        status: waMessageId ? 'PENDING' : 'FAILED',
        sentAt: new Date(),
        failedAt: sendError ? new Date() : null,
        failureReason: sendError,
        replyToMessageId,
        sentBy: userId,
      },
      include: {
        replyToMessage: true,
      },
    });

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Update contact message count
    await prisma.contact.update({
      where: { id: conversation.contactId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // ========================================
    // 🔌 EMIT SOCKET EVENT FOR SENT MESSAGE
    // ========================================
    const formattedMessage = formatMessage(message);
    const formattedConversation = formatConversation(updatedConversation);

    // Emit to organization room
    emitSocketEvent('message:new', `org:${organizationId}`, {
      message: formattedMessage,
      conversation: formattedConversation,
    });

    // Emit to conversation-specific room
    emitSocketEvent('message:new', `conversation:${conversationId}`, {
      message: formattedMessage,
    });

    // Emit conversation updated
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    console.log(`✅ Message sent to ${toPhone} in conversation ${conversationId}`);

    return formattedMessage;
  }

  // ==========================================
  // MARK AS READ
  // ==========================================
  async markAsRead(
    organizationId: string,
    conversationId: string
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isRead: true,
        unreadCount: 0,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    emitSocketEvent('conversation:read', `org:${organizationId}`, {
      conversationId,
      isRead: true,
      unreadCount: 0,
    });

    return formattedConversation;
  }

  // ==========================================
  // ARCHIVE CONVERSATION
  // ==========================================
  async archiveConversation(
    organizationId: string,
    conversationId: string,
    archive: boolean = true
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived: archive },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    emitSocketEvent('conversation:archived', `org:${organizationId}`, {
      conversationId,
      isArchived: archive,
    });

    return formattedConversation;
  }

  // ==========================================
  // ASSIGN CONVERSATION
  // ==========================================
  async assignConversation(
    organizationId: string,
    conversationId: string,
    assignToUserId: string | null,
    assignedByUserId?: string
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Verify user belongs to organization if assigning
    let assignedUser = null;
    if (assignToUserId) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: assignToUserId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      if (!member) {
        throw new AppError('User is not a member of this organization', 400);
      }
      assignedUser = member.user;
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: assignToUserId },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENTS
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    emitSocketEvent('conversation:assigned', `org:${organizationId}`, {
      conversationId,
      assignedTo: assignToUserId,
      assignedUser,
      assignedBy: assignedByUserId,
    });

    // Notify the assigned user directly
    if (assignToUserId) {
      emitSocketEvent('conversation:assignedToYou', `user:${assignToUserId}`, {
        conversation: formattedConversation,
      });
    }

    return formattedConversation;
  }

  // ==========================================
  // UPDATE CONVERSATION
  // ==========================================
  async updateConversation(
    organizationId: string,
    conversationId: string,
    input: UpdateConversationInput
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: input.isArchived,
        isRead: input.isRead,
        labels: input.labels,
        assignedTo: input.assignedTo,
        status: input.status,
        unreadCount: input.isRead ? 0 : undefined,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    return formattedConversation;
  }

  // ==========================================
  // ADD LABELS
  // ==========================================
  async addLabels(
    organizationId: string,
    conversationId: string,
    labels: string[]
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const currentLabels = conversation.labels || [];
    const newLabels = [...new Set([...currentLabels, ...labels])];

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels: newLabels },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    emitSocketEvent('conversation:labelsUpdated', `org:${organizationId}`, {
      conversationId,
      labels: newLabels,
    });

    return formattedConversation;
  }

  // ==========================================
  // REMOVE LABEL
  // ==========================================
  async removeLabel(
    organizationId: string,
    conversationId: string,
    label: string
  ): Promise<ConversationResponse> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const currentLabels = conversation.labels || [];
    const newLabels = currentLabels.filter((l) => l !== label);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels: newLabels },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const formattedConversation = formatConversation(updated);

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    return formattedConversation;
  }

  // ==========================================
  // DELETE CONVERSATION
  // ==========================================
  async deleteConversation(
    organizationId: string,
    conversationId: string
  ): Promise<{ message: string }> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversation:deleted', `org:${organizationId}`, {
      conversationId,
    });

    return { message: 'Conversation deleted successfully' };
  }

  // ==========================================
  // BULK UPDATE CONVERSATIONS
  // ==========================================
  async bulkUpdate(
    organizationId: string,
    conversationIds: string[],
    updates: Partial<UpdateConversationInput>
  ): Promise<{ updated: number }> {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organizationId,
      },
      data: {
        isArchived: updates.isArchived,
        isRead: updates.isRead,
        assignedTo: updates.assignedTo,
        unreadCount: updates.isRead ? 0 : undefined,
      },
    });

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('conversations:bulkUpdated', `org:${organizationId}`, {
      conversationIds,
      updates,
      count: result.count,
    });

    return { updated: result.count };
  }

  // ==========================================
  // SEARCH MESSAGES
  // ==========================================
  async searchMessages(
    organizationId: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: (MessageResponse & { conversationId: string; contact: any })[]; total: number }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          conversation: { organizationId },
          content: { contains: query, mode: 'insensitive' },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { organizationId },
          content: { contains: query, mode: 'insensitive' },
        },
      }),
    ]);

    return {
      messages: messages.map((m) => ({
        ...formatMessage(m),
        conversationId: m.conversationId,
        contact: formatContact(m.conversation.contact),
      })),
      total,
    };
  }

  // ==========================================
  // GET INBOX STATS
  // ==========================================
  async getStats(organizationId: string, userId: string): Promise<InboxStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalConversations,
      unreadConversations,
      archivedConversations,
      assignedToMe,
      unassigned,
      openConversations,
      todayMessages,
    ] = await Promise.all([
      prisma.conversation.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId, isRead: false, isArchived: false } }),
      prisma.conversation.count({ where: { organizationId, isArchived: true } }),
      prisma.conversation.count({ where: { organizationId, assignedTo: userId } }),
      prisma.conversation.count({ where: { organizationId, assignedTo: null, isArchived: false } }),
      prisma.conversation.count({ where: { organizationId, status: 'OPEN' } }),
      prisma.message.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: today },
        },
      }),
    ]);

    // TODO: Calculate response rate and average response time
    const responseRate = 0;
    const averageResponseTime = 0;

    return {
      totalConversations,
      unreadConversations,
      archivedConversations,
      assignedToMe,
      unassigned,
      openConversations,
      todayMessages,
      responseRate,
      averageResponseTime,
    };
  }

  // ==========================================
  // GET ALL LABELS
  // ==========================================
  async getAllLabels(organizationId: string): Promise<{ label: string; count: number }[]> {
    const conversations = await prisma.conversation.findMany({
      where: { organizationId },
      select: { labels: true },
    });

    const labelCounts = new Map<string, number>();
    for (const conv of conversations) {
      for (const label of conv.labels) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }

    return Array.from(labelCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ==========================================
  // CREATE OR GET CONVERSATION
  // ==========================================
  async getOrCreateConversation(
    organizationId: string,
    contactId: string
  ): Promise<ConversationResponse> {
    // Check if conversation exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId,
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const isNew = !conversation;

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId,
          status: 'OPEN',
        },
        include: {
          contact: true,
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });
    }

    const formattedConversation = formatConversation(conversation);

    // ========================================
    // 🔌 EMIT SOCKET EVENT FOR NEW CONVERSATION
    // ========================================
    if (isNew) {
      emitSocketEvent('conversation:new', `org:${organizationId}`, {
        conversation: formattedConversation,
      });
    }

    return formattedConversation;
  }

  // ==========================================
  // TYPING INDICATOR
  // ==========================================
  async sendTypingIndicator(
    organizationId: string,
    conversationId: string,
    userId: string,
    isTyping: boolean
  ): Promise<void> {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    // ========================================
    // 🔌 EMIT SOCKET EVENT
    // ========================================
    emitSocketEvent('typing', `conversation:${conversationId}`, {
      conversationId,
      user,
      isTyping,
    });

    emitSocketEvent('typing', `org:${organizationId}`, {
      conversationId,
      user,
      isTyping,
    });
  }
}

// Export singleton instance
export const inboxService = new InboxService();