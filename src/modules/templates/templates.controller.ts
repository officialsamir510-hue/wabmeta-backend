// src/modules/templates/templates.controller.ts

import { Request, Response, NextFunction } from 'express';
import { templatesService } from './templates.service';
import { successResponse, errorResponse } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplatesQueryInput,
} from './templates.types';

// Extended Request interface with user context
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

class TemplatesController {
  // ==========================================
  // CREATE TEMPLATE
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateTemplateInput & { whatsappAccountId?: string } = req.body;

      // Validate template
      const validation = templatesService.validateTemplate(input);
      if (!validation.valid) {
        throw new AppError(validation.errors.join(', '), 400);
      }

      const template = await templatesService.create(organizationId, input);

      return successResponse(res, {
        data: template,
        message: 'Template created successfully',
        statusCode: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATES LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: TemplatesQueryInput & { whatsappAccountId?: string } = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        category: req.query.category as any,
        language: req.query.language as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        whatsappAccountId: req.query.whatsappAccountId as string, // ✅ Filter by account
      };

      const result = await templatesService.getList(organizationId, query);

      return res.json({
        success: true,
        message: 'Templates fetched successfully',
        data: result.templates,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATE BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const template = await templatesService.getById(organizationId, id);

      return successResponse(res, {
        data: template,
        message: 'Template fetched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE TEMPLATE
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const input: UpdateTemplateInput = req.body;
      const template = await templatesService.update(organizationId, id, input);

      return successResponse(res, {
        data: template,
        message: 'Template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE TEMPLATE
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const result = await templatesService.delete(organizationId, id);

      return successResponse(res, {
        data: result,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DUPLICATE TEMPLATE
  // ==========================================
  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const { name, whatsappAccountId } = req.body;

      if (!name) {
        throw new AppError('New template name is required', 400);
      }

      const template = await templatesService.duplicate(
        organizationId,
        id,
        name,
        whatsappAccountId // ✅ Target account for duplicate
      );

      return successResponse(res, {
        data: template,
        message: 'Template duplicated successfully',
        statusCode: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATE STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = req.query.whatsappAccountId as string;
      const stats = await templatesService.getStats(organizationId, whatsappAccountId);

      return successResponse(res, {
        data: stats,
        message: 'Stats fetched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PREVIEW TEMPLATE
  // ==========================================
  async preview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bodyText, variables, headerType, headerContent, footerText, buttons } = req.body;

      if (!bodyText) {
        throw new AppError('Body text is required', 400);
      }

      const preview = await templatesService.preview(
        bodyText,
        variables || {},
        headerType,
        headerContent,
        footerText,
        buttons
      );

      return successResponse(res, {
        data: preview,
        message: 'Preview generated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET APPROVED TEMPLATES
  // ==========================================
  async getApproved(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = req.query.whatsappAccountId as string;

      const templates = await templatesService.getApprovedTemplates(
        organizationId,
        whatsappAccountId
      );

      return successResponse(res, {
        data: templates,
        message: 'Approved templates fetched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET LANGUAGES
  // ==========================================
  async getLanguages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = req.query.whatsappAccountId as string;
      const languages = await templatesService.getLanguages(organizationId, whatsappAccountId);

      return successResponse(res, {
        data: languages,
        message: 'Languages fetched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SUBMIT TO META
  // ==========================================
  async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;

      const result = await templatesService.submitToMeta(organizationId, id);

      return successResponse(res, {
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SYNC FROM META
  // ==========================================
  async sync(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = req.body?.whatsappAccountId as string;

      const result = await templatesService.syncFromMeta(organizationId, whatsappAccountId);

      return successResponse(res, {
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const templatesController = new TemplatesController();
export default templatesController;