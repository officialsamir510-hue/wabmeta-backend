// src/modules/chatbot/chatbot.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { ChatbotStatus, Prisma } from '@prisma/client';
import { ChatbotEngine } from './chatbot.engine';
import {
  CreateChatbotInput,
  UpdateChatbotInput,
  ChatbotsQueryInput,
  ChatbotResponse,
  ChatbotsListResponse,
  ChatbotStats,
  FlowData,
  TestChatbotInput,
  TestChatbotResponse,
  ChatbotSession,
  ExecutionContext,
  OutgoingMessage,
} from './chatbot.types';

// In-memory session store (use Redis in production)
const sessionStore = new Map<string, ChatbotSession>();

// ============================================
// HELPER FUNCTIONS
// ============================================

const parseFlowData = (data: any): FlowData => {
  if (!data) {
    return { nodes: [], edges: [] };
  }
  
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as FlowData;
    } catch {
      return { nodes: [], edges: [] };
    }
  }
  
  return data as FlowData;
};

const formatChatbot = (chatbot: any): ChatbotResponse => ({
  id: chatbot.id,
  name: chatbot.name,
  description: chatbot.description,
  triggerKeywords: chatbot.triggerKeywords || [],
  isDefault: chatbot.isDefault,
  welcomeMessage: chatbot.welcomeMessage,
  fallbackMessage: chatbot.fallbackMessage,
  flowData: parseFlowData(chatbot.flowData),
  status: chatbot.status,
  createdAt: chatbot.createdAt,
  updatedAt: chatbot.updatedAt,
});

const toJsonValue = (value: any): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// CHATBOT SERVICE CLASS
// ============================================

export class ChatbotService {
  // ==========================================
  // CREATE CHATBOT
  // ==========================================
  async create(organizationId: string, input: CreateChatbotInput): Promise<ChatbotResponse> {
    const { name, description, triggerKeywords, isDefault, welcomeMessage, fallbackMessage, flowData } = input;

    // Check organization limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { chatbots: true } },
      },
    });

    if (org?.subscription?.plan) {
      if (org._count.chatbots >= org.subscription.plan.maxChatbots) {
        throw new AppError('Chatbot limit reached. Please upgrade your plan.', 400);
      }
    }

    // If setting as default, remove default from others
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
        triggerKeywords: triggerKeywords || [],
        isDefault: isDefault || false,
        welcomeMessage,
        fallbackMessage,
        flowData: flowData ? toJsonValue(flowData) : toJsonValue({ nodes: [], edges: [] }),
        status: 'DRAFT',
      },
    });

    return formatChatbot(chatbot);
  }

  // ==========================================
  // GET CHATBOTS LIST
  // ==========================================
  async getList(organizationId: string, query: ChatbotsQueryInput): Promise<ChatbotsListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ChatbotWhereInput = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [chatbots, total] = await Promise.all([
      prisma.chatbot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.chatbot.count({ where }),
    ]);

    return {
      chatbots: chatbots.map(formatChatbot),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

    return formatChatbot(chatbot);
  }

  // ==========================================
  // UPDATE CHATBOT
  // ==========================================
  async update(
    organizationId: string,
    chatbotId: string,
    input: UpdateChatbotInput
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

    // If setting as default, remove default from others
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
        triggerKeywords: input.triggerKeywords,
        isDefault: input.isDefault,
        welcomeMessage: input.welcomeMessage,
        fallbackMessage: input.fallbackMessage,
        flowData: input.flowData ? toJsonValue(input.flowData) : undefined,
        status: input.status,
      },
    });

    return formatChatbot(updated);
  }

  // ==========================================
  // DELETE CHATBOT
  // ==========================================
  async delete(organizationId: string, chatbotId: string): Promise<{ message: string }> {
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

    return { message: 'Chatbot deleted successfully' };
  }

  // ==========================================
  // DUPLICATE CHATBOT
  // ==========================================
  async duplicate(
    organizationId: string,
    chatbotId: string,
    newName: string
  ): Promise<ChatbotResponse> {
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
        name: newName,
        description: original.description,
        triggerKeywords: original.triggerKeywords,
        isDefault: false,
        welcomeMessage: original.welcomeMessage,
        fallbackMessage: original.fallbackMessage,
        flowData: original.flowData || toJsonValue({ nodes: [], edges: [] }),
        status: 'DRAFT',
      },
    });

    return formatChatbot(duplicate);
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

    // Validate flow has at least one trigger node
    const flowData = parseFlowData(chatbot.flowData);
    if (!flowData.nodes || flowData.nodes.length === 0) {
      throw new AppError('Chatbot flow is empty. Add nodes before activating.', 400);
    }

    const hasTrigger = flowData.nodes.some((n) => n.type === 'trigger');
    if (!hasTrigger) {
      throw new AppError('Chatbot must have at least one trigger node.', 400);
    }

    const updated = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { status: 'ACTIVE' },
    });

    return formatChatbot(updated);
  }

  // ==========================================
  // PAUSE CHATBOT
  // ==========================================
  async pause(organizationId: string, chatbotId: string): Promise<ChatbotResponse> {
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

    return formatChatbot(updated);
  }

  // ==========================================
  // SAVE FLOW
  // ==========================================
  async saveFlow(
    organizationId: string,
    chatbotId: string,
    flowData: FlowData
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

    const updated = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { flowData: toJsonValue(flowData) },
    });

    return formatChatbot(updated);
  }

  // ==========================================
  // TEST CHATBOT
  // ==========================================
  async test(
    organizationId: string,
    chatbotId: string,
    input: TestChatbotInput
  ): Promise<TestChatbotResponse> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        organizationId,
      },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    const flowData = parseFlowData(chatbot.flowData);
    if (!flowData.nodes || flowData.nodes.length === 0) {
      return {
        messages: [{ type: 'text', content: 'Chatbot flow is empty.' }],
        sessionData: {},
        ended: true,
      };
    }

    const engine = new ChatbotEngine(flowData);
    
    // Get or create session
    let session: ChatbotSession = (input.sessionData as ChatbotSession) || {
      chatbotId,
      contactId: 'test-contact',
      currentNodeId: '',
      variables: {},
      lastInteraction: new Date(),
      isActive: true,
    };

    const context: ExecutionContext = {
      organizationId,
      contactId: 'test-contact',
      contactPhone: input.contactPhone || '+919999999999',
      contactName: 'Test User',
      incomingMessage: input.message,
      session,
      variables: session.variables,
    };

    const allMessages: OutgoingMessage[] = [];
    let currentNodeId = session.currentNodeId;
    let ended = false;

    // Find starting node
    if (!currentNodeId) {
      const triggerNode = engine.findTriggerNode(input.message, true);
      if (triggerNode) {
        currentNodeId = triggerNode.id;
      } else {
        return {
          messages: [{
            type: 'text',
            content: chatbot.fallbackMessage || 'Sorry, I didn\'t understand that.',
          }],
          sessionData: session as Record<string, any>,
          ended: false,
        };
      }
    }

    // Execute nodes until we need to wait for input or end
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops

    while (currentNodeId && iterations < maxIterations && !ended) {
      iterations++;

      const node = flowData.nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      const result = await engine.executeNode(node, context);
      
      allMessages.push(...result.messages);
      context.variables = { ...context.variables, ...result.variables };

      if (result.ended) {
        ended = true;
        break;
      }

      if (result.waitingForInput) {
        session.currentNodeId = currentNodeId;
        break;
      }

      currentNodeId = result.nextNodeId || '';
    }

    session.variables = context.variables;
    session.currentNodeId = currentNodeId;

    return {
      messages: allMessages.map((m) => ({
        type: m.type,
        content: m.content || '',
        buttons: m.buttons,
        listSections: m.listSections,
      })),
      nextNodeId: currentNodeId,
      sessionData: session as Record<string, any>,
      ended,
    };
  }

  // ==========================================
  // GET STATS
  // ==========================================
  async getStats(organizationId: string): Promise<ChatbotStats> {
    const [total, active, draft, paused] = await Promise.all([
      prisma.chatbot.count({ where: { organizationId } }),
      prisma.chatbot.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.chatbot.count({ where: { organizationId, status: 'DRAFT' } }),
      prisma.chatbot.count({ where: { organizationId, status: 'PAUSED' } }),
    ]);

    // TODO: Track actual conversations and messages handled by chatbot
    const totalConversations = 0;
    const messagesHandled = 0;

    return {
      total,
      active,
      draft,
      paused,
      totalConversations,
      messagesHandled,
    };
  }

  // ==========================================
  // PROCESS INCOMING MESSAGE (Called by webhook)
  // ==========================================
  async processIncomingMessage(
    organizationId: string,
    contactId: string,
    contactPhone: string,
    contactName: string,
    message: string,
    isFirstMessage: boolean = false
  ): Promise<OutgoingMessage[] | null> {
    // Find matching chatbot
    const chatbots = await prisma.chatbot.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      orderBy: { isDefault: 'desc' },
    });

    if (chatbots.length === 0) return null;

    // Check for keyword triggers
    let matchedChatbot = null;
    const lowerMessage = message.toLowerCase();

    for (const chatbot of chatbots) {
      const flowData = parseFlowData(chatbot.flowData);
      if (!flowData.nodes) continue;

      // Check trigger keywords
      for (const keyword of chatbot.triggerKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          matchedChatbot = chatbot;
          break;
        }
      }

      if (matchedChatbot) break;

      // Check flow trigger nodes
      const engine = new ChatbotEngine(flowData);
      const triggerNode = engine.findTriggerNode(message, isFirstMessage);
      if (triggerNode) {
        matchedChatbot = chatbot;
        break;
      }
    }

    // Use default chatbot if no match
    if (!matchedChatbot) {
      matchedChatbot = chatbots.find((c) => c.isDefault);
    }

    if (!matchedChatbot) return null;

    // Get or create session
    const sessionKey = `${matchedChatbot.id}:${contactId}`;
    let session = sessionStore.get(sessionKey);

    if (!session) {
      session = {
        chatbotId: matchedChatbot.id,
        contactId,
        currentNodeId: '',
        variables: {},
        lastInteraction: new Date(),
        isActive: true,
      };
    }

    // Execute chatbot
    const flowData = parseFlowData(matchedChatbot.flowData);
    const engine = new ChatbotEngine(flowData);

    const context: ExecutionContext = {
      organizationId,
      contactId,
      contactPhone,
      contactName,
      incomingMessage: message,
      session,
      variables: session.variables,
    };

    const allMessages: OutgoingMessage[] = [];
    let currentNodeId = session.currentNodeId;
    let ended = false;

    // Find starting node if no current node
    if (!currentNodeId) {
      const triggerNode = engine.findTriggerNode(message, isFirstMessage);
      if (triggerNode) {
        currentNodeId = triggerNode.id;
      } else {
        return null;
      }
    }

    // Execute nodes
    let iterations = 0;
    const maxIterations = 20;

    while (currentNodeId && iterations < maxIterations && !ended) {
      iterations++;

      const node = flowData.nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      const result = await engine.executeNode(node, context);
      
      allMessages.push(...result.messages);
      context.variables = { ...context.variables, ...result.variables };

      if (result.ended) {
        ended = true;
        sessionStore.delete(sessionKey);
        break;
      }

      if (result.waitingForInput) {
        session.currentNodeId = currentNodeId;
        session.variables = context.variables;
        session.lastInteraction = new Date();
        sessionStore.set(sessionKey, session);
        break;
      }

      currentNodeId = result.nextNodeId || '';
    }

    return allMessages;
  }

  // ==========================================
  // GET DEFAULT CHATBOT
  // ==========================================
  async getDefault(organizationId: string): Promise<ChatbotResponse | null> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        organizationId,
        isDefault: true,
        status: 'ACTIVE',
      },
    });

    return chatbot ? formatChatbot(chatbot) : null;
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService();