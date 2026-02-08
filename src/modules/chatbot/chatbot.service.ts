// src/modules/chatbot/chatbot.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { Prisma, ChatbotStatus } from '@prisma/client';
import { ChatbotInput, ChatbotResponse, FlowData, ChatbotStats } from './chatbot.types';

export class ChatbotService {
  // ==========================================
  // GET ALL CHATBOTS
  // ==========================================
  async getAll(
    organizationId: string,
    params: {
      page?: number;
      limit?: number;
      status?: ChatbotStatus;
      search?: string;
    }
  ): Promise<{ chatbots: ChatbotResponse[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ChatbotWhereInput = {
      organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [chatbots, total] = await Promise.all([
      prisma.chatbot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.chatbot.count({ where }),
    ]);

    return {
      chatbots: chatbots.map(this.formatChatbot),
      total,
      page,
      limit,
    };
  }

  // ==========================================
  // GET CHATBOT BY ID
  // ==========================================
  async getById(organizationId: string, chatbotId: string): Promise<ChatbotResponse> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    return this.formatChatbot(chatbot);
  }

  // ==========================================
  // CREATE CHATBOT
  // ==========================================
  async create(organizationId: string, input: ChatbotInput): Promise<ChatbotResponse> {
    const { name, description, flowData, triggerKeywords, isDefault, welcomeMessage, fallbackMessage } = input;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.chatbot.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const chatbot = await prisma.chatbot.create({
      data: {
        organizationId,
        name,
        description,
        flowData: (flowData || { nodes: [], edges: [] }) as any,
        triggerKeywords: triggerKeywords || [],
        isDefault: isDefault || false,
        welcomeMessage,
        fallbackMessage,
        status: 'DRAFT',
      },
    });

    return this.formatChatbot(chatbot);
  }

  // ==========================================
  // UPDATE CHATBOT
  // ==========================================
  async update(
    organizationId: string,
    chatbotId: string,
    input: Partial<ChatbotInput>
  ): Promise<ChatbotResponse> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.chatbot.updateMany({
        where: { organizationId, isDefault: true, id: { not: chatbotId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: {
        name: input.name,
        description: input.description,
        flowData: input.flowData ? (input.flowData as any) : undefined,
        triggerKeywords: input.triggerKeywords,
        isDefault: input.isDefault,
        welcomeMessage: input.welcomeMessage,
        fallbackMessage: input.fallbackMessage,
        status: input.status,
      },
    });

    return this.formatChatbot(updated);
  }

  // ==========================================
  // DELETE CHATBOT
  // ==========================================
  async delete(organizationId: string, chatbotId: string): Promise<void> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    await prisma.chatbot.delete({
      where: { id: chatbotId },
    });
  }

  // ==========================================
  // ACTIVATE CHATBOT
  // ==========================================
  async activate(organizationId: string, chatbotId: string): Promise<ChatbotResponse> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    // Validate flow before activation
    const flowData = chatbot.flowData as any as FlowData;
    if (!flowData.nodes || flowData.nodes.length === 0) {
      throw new AppError('Chatbot must have at least one node to activate', 400);
    }

    const updated = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { status: 'ACTIVE' },
    });

    return this.formatChatbot(updated);
  }

  // ==========================================
  // DEACTIVATE (PAUSE) CHATBOT
  // ==========================================
  async deactivate(organizationId: string, chatbotId: string): Promise<ChatbotResponse> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    const updated = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { status: 'PAUSED' },
    });

    return this.formatChatbot(updated);
  }

  // ==========================================
  // DUPLICATE CHATBOT
  // ==========================================
  async duplicate(organizationId: string, chatbotId: string): Promise<ChatbotResponse> {
    const original = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!original) {
      throw new AppError('Chatbot not found', 404);
    }

    const duplicate = await prisma.chatbot.create({
      data: {
        organizationId,
        name: `${original.name} (Copy)`,
        description: original.description,
        flowData: original.flowData,
        triggerKeywords: original.triggerKeywords,
        isDefault: false,
        welcomeMessage: original.welcomeMessage,
        fallbackMessage: original.fallbackMessage,
        status: 'DRAFT',
      },
    });

    return this.formatChatbot(duplicate);
  }

  // ==========================================
  // GET CHATBOT STATS
  // ==========================================
  async getStats(organizationId: string, chatbotId: string): Promise<ChatbotStats> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    // TODO: Implement actual stats from ChatbotSession/Activity logs
    // For now, return placeholder stats
    return {
      totalConversations: 0,
      messagesHandled: 0,
      fallbackTriggered: 0,
      avgResponseTime: 0,
    };
  }

  // ==========================================
  // GET ACTIVE CHATBOTS FOR ORGANIZATION
  // ==========================================
  async getActiveChatbots(organizationId: string): Promise<ChatbotResponse[]> {
    const chatbots = await prisma.chatbot.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return chatbots.map(this.formatChatbot);
  }

  // ==========================================
  // FIND MATCHING CHATBOT FOR MESSAGE
  // ==========================================
  async findMatchingChatbot(
    organizationId: string,
    messageText: string,
    isNewConversation: boolean
  ): Promise<ChatbotResponse | null> {
    const activeChatbots = await this.getActiveChatbots(organizationId);

    if (activeChatbots.length === 0) {
      return null;
    }

    const lowerMessage = messageText.toLowerCase().trim();

    // First, check for keyword matches
    for (const chatbot of activeChatbots) {
      if (chatbot.triggerKeywords && chatbot.triggerKeywords.length > 0) {
        for (const keyword of chatbot.triggerKeywords) {
          const lowerKeyword = keyword.toLowerCase().trim();
          if (lowerMessage.includes(lowerKeyword) || lowerMessage === lowerKeyword) {
            return chatbot;
          }
        }
      }
    }

    // If new conversation and no keyword match, use default chatbot
    if (isNewConversation) {
      const defaultChatbot = activeChatbots.find(c => c.isDefault);
      if (defaultChatbot) {
        return defaultChatbot;
      }
    }

    return null;
  }

  // ==========================================
  // HELPER: Format chatbot response
  // ==========================================
  private formatChatbot(chatbot: any): ChatbotResponse {
    return {
      id: chatbot.id,
      name: chatbot.name,
      description: chatbot.description,
      flowData: chatbot.flowData as FlowData || { nodes: [], edges: [] },
      triggerKeywords: chatbot.triggerKeywords || [],
      isDefault: chatbot.isDefault,
      welcomeMessage: chatbot.welcomeMessage,
      fallbackMessage: chatbot.fallbackMessage,
      status: chatbot.status,
      createdAt: chatbot.createdAt,
      updatedAt: chatbot.updatedAt,
    };
  }
}

export const chatbotService = new ChatbotService();