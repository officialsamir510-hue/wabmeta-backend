// src/modules/chatbot/chatbot.controller.ts

import { Request, Response, NextFunction } from 'express';
import { chatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateChatbotInput,
  UpdateChatbotInput,
  ChatbotsQueryInput,
  TestChatbotInput,
  FlowData,
} from './chatbot.types';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class ChatbotController {
  // ==========================================
  // CREATE CHATBOT
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateChatbotInput = req.body;
      const chatbot = await chatbotService.create(organizationId, input);
      return sendSuccess(res, chatbot, 'Chatbot created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CHATBOTS LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: ChatbotsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await chatbotService.getList(organizationId, query);
      return res.json({
        success: true,
        message: 'Chatbots fetched successfully',
        data: result.chatbots,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CHATBOT BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const chatbot = await chatbotService.getById(organizationId, id);
      return sendSuccess(res, chatbot, 'Chatbot fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CHATBOT
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const input: UpdateChatbotInput = req.body;
      const chatbot = await chatbotService.update(organizationId, id, input);
      return sendSuccess(res, chatbot, 'Chatbot updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CHATBOT
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const result = await chatbotService.delete(organizationId, id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DUPLICATE CHATBOT
  // ==========================================
  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const { name } = req.body;
      const chatbot = await chatbotService.duplicate(organizationId, id, name);
      return sendSuccess(res, chatbot, 'Chatbot duplicated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ACTIVATE CHATBOT
  // ==========================================
  async activate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const chatbot = await chatbotService.activate(organizationId, id);
      return sendSuccess(res, chatbot, 'Chatbot activated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PAUSE CHATBOT
  // ==========================================
  async pause(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const chatbot = await chatbotService.pause(organizationId, id);
      return sendSuccess(res, chatbot, 'Chatbot paused successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SAVE FLOW
  // ==========================================
  async saveFlow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const { flowData } = req.body;
      const chatbot = await chatbotService.saveFlow(organizationId, id, flowData);
      return sendSuccess(res, chatbot, 'Flow saved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // TEST CHATBOT
  // ==========================================
  async test(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const input: TestChatbotInput = req.body;
      const result = await chatbotService.test(organizationId, id, input);
      return sendSuccess(res, result, 'Test executed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await chatbotService.getStats(organizationId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const chatbotController = new ChatbotController();