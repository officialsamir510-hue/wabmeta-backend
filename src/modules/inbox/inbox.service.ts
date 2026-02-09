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
// SOCKET HELPER
// ============================================
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

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatContact = (contact: any) => {
  if (!contact) return null;
  return {
    id: contact.id,
    phone: contact.phone,
    fullPhone: `${contact.countryCode || ''}${contact.phone}`,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone,
    avatar: contact.avatar,
    email: contact.email,
    tags: contact.tags || [],
  };
};

const formatMessage = (message: any): MessageResponse => ({
  id: message.id,
  wamId: message.wamId || null,
  waMessageId: message.waMessageId || null,
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
  createdAt: message.createdAt,
});

const formatConversation = (conversation: any, assignedUser?: any): ConversationResponse => {
  const formattedContact = formatContact(conversation.contact);
  if (!formattedContact) {
    throw new AppError('Conversation contact is missing', 400);
  }
  return {
    id: conversation.id,
    contact: formattedContact,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    isArchived: conversation.isArchived,
    isRead: conversation.isRead,
    unreadCount: conversation.unreadCount,
    assignedTo: conversation.assignedTo,
    assignedUser: assignedUser ? {
      id: assignedUser.id,
      firstName: assignedUser.firstName,
      lastName: assignedUser.lastName,
      avatar: assignedUser.avatar,
    } : undefined,
    labels: conversation.labels || [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

// Helper to get assigned user
const getAssignedUser = async (userId: string | null) => {
  if (!userId) return null;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });
    return user;
  } catch {
    return null;
  }
};

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

    // Get assigned users
    const assignedUserIds = [...new Set(conversations.map(c => c.assignedTo).filter(Boolean))] as string[];
    const assignedUsers = assignedUserIds.length > 0 
      ? await prisma.user.findMany({
          where: { id: { in: assignedUserIds } },
          select: { id: true, firstName: true, lastName: true, avatar: true },
        })
      : [];

    const userMap = new Map(assignedUsers.map(u => [u.id, u]));

    return {
      conversations: conversations.map(conv => 
        formatConversation(conv, conv.assignedTo ? userMap.get(conv.assignedTo) : undefined)
      ),
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
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const [totalMessages, assignedUser] = await Promise.all([
      prisma.message.count({ where: { conversationId } }),
      getAssignedUser(conversation.assignedTo),
    ]);

    return {
      ...formatConversation(conversation, assignedUser),
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
    const { type = 'text', content, mediaUrl, mediaType, filename, replyToMessageId, interactive } = input;

    // Get conversation with contact
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
      let result: any;

      switch (type) {
        case 'text':
          if (!content) throw new AppError('Content is required for text messages', 400);
          result = await whatsappService.sendTextMessage(
            organizationId,
            waAccount.id,
            toPhone,
            content,
            replyToMessageId || undefined
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
            type as 'image' | 'video' | 'audio' | 'document',
            mediaUrl,
            content || undefined,
            filename
          );
          break;

        case 'interactive':
  if (!interactive || !content) throw new AppError('Interactive config and body text required', 400);
  
  // ✅ Process sections to ensure title is always string
  const processedSections = interactive.sections
    ?.filter(s => s.title != null) // Filter out null/undefined titles
    .map(s => ({
      title: String(s.title), // Convert to string explicitly
      rows: s.rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
      }))
    }));

  result = await whatsappService.sendInteractiveMessage(
    organizationId,
    waAccount.id,
    toPhone,
    interactive.type || 'button',
    content,
    {
      buttons: interactive.buttons,
      sections: processedSections,
      buttonText: interactive.buttonText,
    }
  );
  break;

default:
  // Default to text
  if (content) {
    result = await whatsappService.sendTextMessage(
      organizationId,
      waAccount.id,
      toPhone,
      content
    );
  } else {
    throw new AppError('Content is required', 400);
  }
      }

      if (result?.success || result?.messages?.[0]?.id) {
        waMessageId = result.messageId || result.messages?.[0]?.id;
      } else if (result?.error) {
        sendError = result.error;
      }
    } catch (error: any) {
      console.error('WhatsApp send error:', error);
      sendError = error.message || 'Failed to send message';
    }

    // Determine message type for database
    const dbMessageType = type.toUpperCase() as MessageType;

    // Save message to database
    const message = await prisma.message.create({
      data: {
        conversationId,
        whatsappAccountId: waAccount.id,
        waMessageId: waMessageId || null,
        direction: 'OUTBOUND',
        type: dbMessageType === 'INTERACTIVE' ? 'TEXT' : dbMessageType,
        content: content || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        status: waMessageId ? 'SENT' : 'FAILED',
        sentAt: new Date(),
        failedAt: sendError ? new Date() : null,
        failureReason: sendError || null,
        replyToMessageId: replyToMessageId || null,
      },
    });

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content?.substring(0, 100) || `[${type}]`,
        isWindowOpen: true,
      },
      include: {
        contact: true,
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

    // Get assigned user for formatting
    const assignedUser = await getAssignedUser(updatedConversation.assignedTo);

    const formattedMessage = formatMessage(message);
    const formattedConversation = formatConversation(updatedConversation, assignedUser);

    // ========================================
    // 🔌 EMIT SOCKET EVENTS
    // ========================================
    emitSocketEvent('message:new', `org:${organizationId}`, {
      message: formattedMessage,
      conversation: formattedConversation,
    });

    emitSocketEvent('message:new', `conversation:${conversationId}`, {
      message: formattedMessage,
    });

    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    console.log(`✅ Message ${waMessageId ? 'sent' : 'failed'} to ${toPhone}`);

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
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

    // Emit socket events
    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
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
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

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
    assignToUserId: string | null
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
    if (assignToUserId) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: assignToUserId,
          },
        },
      });

      if (!member) {
        throw new AppError('User is not a member of this organization', 400);
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: assignToUserId },
      include: {
        contact: true,
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
    });

    if (assignToUserId) {
      emitSocketEvent('conversation:assigned', `user:${assignToUserId}`, {
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

    const updateData: Prisma.ConversationUpdateInput = {};
    
    if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;
    if (input.isRead !== undefined) {
      updateData.isRead = input.isRead;
      if (input.isRead) updateData.unreadCount = 0;
    }
    if (input.labels !== undefined) updateData.labels = input.labels;
    if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        contact: true,
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

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
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

    emitSocketEvent('conversation:updated', `org:${organizationId}`, {
      conversation: formattedConversation,
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
      },
    });

    const assignedUser = await getAssignedUser(updated.assignedTo);
    const formattedConversation = formatConversation(updated, assignedUser);

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
    const updateData: Prisma.ConversationUpdateManyMutationInput = {};
    
    if (updates.isArchived !== undefined) updateData.isArchived = updates.isArchived;
    if (updates.isRead !== undefined) {
      updateData.isRead = updates.isRead;
      if (updates.isRead) updateData.unreadCount = 0;
    }
    if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;

    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organizationId,
      },
      data: updateData,
    });

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
  ): Promise<{ messages: any[]; total: number }> {
    if (!query || query.trim().length < 2) {
      return { messages: [], total: 0 };
    }

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
      todayMessages,
    ] = await Promise.all([
      prisma.conversation.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId, isRead: false, isArchived: false } }),
      prisma.conversation.count({ where: { organizationId, isArchived: true } }),
      prisma.conversation.count({ where: { organizationId, assignedTo: userId } }),
      prisma.conversation.count({ where: { organizationId, assignedTo: null, isArchived: false } }),
      prisma.message.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: today },
        },
      }),
    ]);

    return {
      totalConversations,
      unreadConversations,
      archivedConversations,
      assignedToMe,
      unassigned,
      todayMessages,
      responseRate: 0,
      averageResponseTime: 0,
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
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId,
      },
      include: {
        contact: true,
      },
    });

    const isNew = !conversation;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          contactId,
        },
        include: {
          contact: true,
        },
      });
    }

    const assignedUser = await getAssignedUser(conversation.assignedTo);
    const formattedConversation = formatConversation(conversation, assignedUser);

    if (isNew) {
      emitSocketEvent('conversation:new', `org:${organizationId}`, {
        conversation: formattedConversation,
      });
    }

    return formattedConversation;
  }
}

export const inboxService = new InboxService();