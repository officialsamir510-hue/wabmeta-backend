// ✅ ADD/UPDATE: src/modules/chatbot/chatbot.controller.ts

import { Request, Response, NextFunction } from 'express';
import { chatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
  user?: { id: string; email: string; organizationId?: string };
}

export class ChatbotController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const result = await chatbotService.getAll(orgId, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
        search: req.query.search as string,
      });
      return res.json({
        success: true,
        message: 'Chatbots fetched',
        data: result.chatbots,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (e) { next(e); }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const chatbot = await chatbotService.getById(orgId, req.params.id as string);
      return sendSuccess(res, chatbot, 'Chatbot fetched');
    } catch (e) { next(e); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const chatbot = await chatbotService.create(orgId, req.user!.id, req.body);
      return sendSuccess(res, chatbot, 'Chatbot created', 201);
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const chatbot = await chatbotService.update(orgId, req.params.id as string, req.body);
      return sendSuccess(res, chatbot, 'Chatbot updated');
    } catch (e) { next(e); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const result = await chatbotService.delete(orgId, req.params.id as string);
      return sendSuccess(res, result, result.message);
    } catch (e) { next(e); }
  }

  async activate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const chatbot = await chatbotService.activate(orgId, req.params.id as string);
      return sendSuccess(res, chatbot, 'Chatbot activated');
    } catch (e) { next(e); }
  }

  async deactivate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const chatbot = await chatbotService.deactivate(orgId, req.params.id as string);
      return sendSuccess(res, chatbot, 'Chatbot paused');
    } catch (e) { next(e); }
  }

  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.organizationId!;
      const { name } = req.body;
      const chatbot = await chatbotService.duplicate(orgId, req.params.id as string, req.user!.id, name);
      return sendSuccess(res, chatbot, 'Chatbot duplicated', 201);
    } catch (e) { next(e); }
  }
}

export const chatbotController = new ChatbotController();