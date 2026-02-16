"use strict";
// src/modules/chatbot/chatbot.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatbotService = exports.ChatbotService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class ChatbotService {
    // ==========================================
    // GET ALL CHATBOTS
    // ==========================================
    async getAll(organizationId, params) {
        const { page = 1, limit = 20, status, search } = params;
        const skip = (page - 1) * limit;
        const where = {
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
            database_1.default.chatbot.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            database_1.default.chatbot.count({ where }),
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
    async getById(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        return this.formatChatbot(chatbot);
    }
    // ==========================================
    // CREATE CHATBOT
    // ==========================================
    async create(organizationId, userId, input) {
        const { name, description, flowData, triggerKeywords, isDefault, welcomeMessage, fallbackMessage } = input;
        // If setting as default, unset other defaults
        if (isDefault) {
            await database_1.default.chatbot.updateMany({
                where: { organizationId, isDefault: true },
                data: { isDefault: false },
            });
        }
        const chatbot = await database_1.default.chatbot.create({
            data: {
                organizationId,
                name,
                description,
                flowData: (flowData || { nodes: [], edges: [] }),
                triggerKeywords: triggerKeywords || [],
                isDefault: isDefault || false,
                welcomeMessage,
                fallbackMessage,
                status: 'DRAFT',
                createdById: userId,
            },
        });
        return this.formatChatbot(chatbot);
    }
    // ==========================================
    // UPDATE CHATBOT
    // ==========================================
    async update(organizationId, chatbotId, input) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        // If setting as default, unset other defaults
        if (input.isDefault) {
            await database_1.default.chatbot.updateMany({
                where: { organizationId, isDefault: true, id: { not: chatbotId } },
                data: { isDefault: false },
            });
        }
        const updated = await database_1.default.chatbot.update({
            where: { id: chatbotId },
            data: {
                name: input.name,
                description: input.description,
                flowData: input.flowData ? input.flowData : undefined,
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
    async delete(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        await database_1.default.chatbot.delete({
            where: { id: chatbotId },
        });
    }
    // ==========================================
    // ACTIVATE CHATBOT
    // ==========================================
    async activate(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        // Validate flow before activation
        const flowData = chatbot.flowData;
        if (!flowData.nodes || flowData.nodes.length === 0) {
            throw new errorHandler_1.AppError('Chatbot must have at least one node to activate', 400);
        }
        const updated = await database_1.default.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'ACTIVE' },
        });
        return this.formatChatbot(updated);
    }
    // ==========================================
    // DEACTIVATE (PAUSE) CHATBOT
    // ==========================================
    async deactivate(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        const updated = await database_1.default.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'PAUSED' },
        });
        return this.formatChatbot(updated);
    }
    // ==========================================
    // DUPLICATE CHATBOT
    // ==========================================
    async duplicate(organizationId, userId, chatbotId) {
        const original = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!original) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        }
        const duplicate = await database_1.default.chatbot.create({
            data: {
                organizationId,
                name: `${original.name} (Copy)`,
                description: original.description,
                flowData: original.flowData || { nodes: [], edges: [] },
                triggerKeywords: original.triggerKeywords,
                isDefault: false,
                welcomeMessage: original.welcomeMessage,
                fallbackMessage: original.fallbackMessage,
                status: 'DRAFT',
                createdById: userId,
            },
        });
        return this.formatChatbot(duplicate);
    }
    // ==========================================
    // GET CHATBOT STATS
    // ==========================================
    async getStats(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId,
            },
        });
        if (!chatbot) {
            throw new errorHandler_1.AppError('Chatbot not found', 404);
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
    async getActiveChatbots(organizationId) {
        const chatbots = await database_1.default.chatbot.findMany({
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
    async findMatchingChatbot(organizationId, messageText, isNewConversation) {
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
    formatChatbot(chatbot) {
        return {
            id: chatbot.id,
            name: chatbot.name,
            description: chatbot.description,
            flowData: chatbot.flowData || { nodes: [], edges: [] },
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
exports.ChatbotService = ChatbotService;
exports.chatbotService = new ChatbotService();
//# sourceMappingURL=chatbot.service.js.map