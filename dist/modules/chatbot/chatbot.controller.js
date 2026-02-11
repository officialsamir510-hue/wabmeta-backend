"use strict";
// src/modules/chatbot/chatbot.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatbotController = exports.ChatbotController = void 0;
const chatbot_service_1 = require("./chatbot.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class ChatbotController {
    // GET /api/v1/chatbot
    async getAll(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { page, limit, status, search } = req.query;
            const result = await chatbot_service_1.chatbotService.getAll(organizationId, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                status: status,
                search: search,
            });
            return res.json({
                success: true,
                message: 'Chatbots fetched successfully',
                data: result.chatbots,
                meta: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit),
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/v1/chatbot/:id
    async getById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const chatbot = await chatbot_service_1.chatbotService.getById(organizationId, id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/chatbot
    async create(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const chatbot = await chatbot_service_1.chatbotService.create(organizationId, req.body);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // PUT /api/v1/chatbot/:id
    async update(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const chatbot = await chatbot_service_1.chatbotService.update(organizationId, id, req.body);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // DELETE /api/v1/chatbot/:id
    async delete(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            await chatbot_service_1.chatbotService.delete(organizationId, id);
            return (0, response_1.sendSuccess)(res, null, 'Chatbot deleted successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/chatbot/:id/activate
    async activate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const chatbot = await chatbot_service_1.chatbotService.activate(organizationId, id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot activated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/chatbot/:id/deactivate
    async deactivate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const chatbot = await chatbot_service_1.chatbotService.deactivate(organizationId, id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot paused successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/chatbot/:id/duplicate
    async duplicate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const chatbot = await chatbot_service_1.chatbotService.duplicate(organizationId, id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot duplicated successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/v1/chatbot/:id/stats
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const stats = await chatbot_service_1.chatbotService.getStats(organizationId, id);
            return (0, response_1.sendSuccess)(res, stats, 'Chatbot stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ChatbotController = ChatbotController;
exports.chatbotController = new ChatbotController();
//# sourceMappingURL=chatbot.controller.js.map