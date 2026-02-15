// src/modules/templates/templates.controller.ts

import { Request, Response, NextFunction } from 'express';
import { templatesService } from './templates.service';
import { successResponse, errorResponse } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, TemplateCategory } from '@prisma/client';
import prisma from '../../config/database';

// Extended Request interface with user context
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
  };
}

class TemplatesController {
  // ==========================================
  // HELPER: Get default WhatsApp account
  // ==========================================
  private async getDefaultAccountId(organizationId: string): Promise<string | undefined> {
    const defaultAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        status: 'CONNECTED',
        isDefault: true,
      },
      select: { id: true },
    });
    return defaultAccount?.id;
  }

  // ==========================================
  // CREATE TEMPLATE
  // ==========================================
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input = req.body;

      // Validate template
      const validation = templatesService.validateTemplate(input);
      if (!validation.valid) {
        throw new AppError(validation.errors.join(', '), 400);
      }

      // If no whatsappAccountId provided, use default
      if (!input.whatsappAccountId) {
        input.whatsappAccountId = await this.getDefaultAccountId(organizationId);
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
  async getList(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      // ✅ Parse query params safely
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = req.query.status as TemplateStatus | undefined;
      const category = req.query.category as TemplateCategory | undefined;
      const language = (req.query.language as string)?.trim() || undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      // ✅ If no whatsappAccountId, use default account
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      console.log('📋 Fetching templates:', {
        organizationId,
        page,
        limit,
        search,
        status,
        category,
        whatsappAccountId,
      });

      const result = await templatesService.getList(organizationId, {
        page,
        limit,
        search,
        status,
        category,
        language,
        sortBy: sortBy as any,
        sortOrder,
        whatsappAccountId,
      });

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
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

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
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const input = req.body;
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
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

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
  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const { name, whatsappAccountId } = req.body;
      if (!name) {
        throw new AppError('New template name is required', 400);
      }

      const template = await templatesService.duplicate(
        organizationId,
        id,
        name,
        whatsappAccountId
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
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      // ✅ If no whatsappAccountId, use default account
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

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
  async preview(req: Request, res: Response, next: NextFunction) {
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
  async getApproved(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      // ✅ If no whatsappAccountId, use default account
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // ✅ If still no account, return empty array (not error)
      if (!whatsappAccountId) {
        return successResponse(res, {
          data: [],
          message: 'No WhatsApp account connected',
        });
      }

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
  async getLanguages(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      // ✅ If no whatsappAccountId, use default account
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

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
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

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
  async sync(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = req.body?.whatsappAccountId?.trim() || undefined;

      // ✅ If no whatsappAccountId, use default account
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // ✅ If still no account, return error
      if (!whatsappAccountId) {
        return errorResponse(res, 'No WhatsApp account connected. Please connect a WhatsApp account first.', 400);
      }

      console.log('🔄 Syncing templates for account:', whatsappAccountId);

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