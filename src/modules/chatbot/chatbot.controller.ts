// src/modules/chatbot/chatbot.controller.ts

import { Request, Response, NextFunction } from 'express';
import { chatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { ChatbotStatus } from '@prisma/client';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class ChatbotController {
  // GET /api/v1/chatbot
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { page, limit, status, search } = req.query;

      const result = await chatbotService.getAll(organizationId, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        status: status as ChatbotStatus | undefined,
        search: search as string | undefined,
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
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/chatbot/:id
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const chatbot = await chatbotService.getById(organizationId, id);

      return sendSuccess(res, chatbot, 'Chatbot fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/chatbot
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const chatbot = await chatbotService.create(organizationId, req.user!.id, req.body);

      return sendSuccess(res, chatbot, 'Chatbot created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/chatbot/:id
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const chatbot = await chatbotService.update(organizationId, id, req.body);

      return sendSuccess(res, chatbot, 'Chatbot updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/chatbot/:id
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      await chatbotService.delete(organizationId, id);

      return sendSuccess(res, null, 'Chatbot deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/chatbot/:id/activate
  async activate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const chatbot = await chatbotService.activate(organizationId, id);

      return sendSuccess(res, chatbot, 'Chatbot activated successfully');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/chatbot/:id/deactivate
  async deactivate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const chatbot = await chatbotService.deactivate(organizationId, id);

      return sendSuccess(res, chatbot, 'Chatbot paused successfully');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/chatbot/:id/duplicate
  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const chatbot = await chatbotService.duplicate(organizationId, req.user!.id, id);

      return sendSuccess(res, chatbot, 'Chatbot duplicated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/chatbot/:id/stats
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const stats = await chatbotService.getStats(organizationId, id);

      return sendSuccess(res, stats, 'Chatbot stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const chatbotController = new ChatbotController();