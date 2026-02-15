// src/modules/templates/templates.controller.ts

import { Request, Response, NextFunction } from 'express';
import { templatesService } from './templates.service';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, TemplateCategory } from '@prisma/client';
import prisma from '../../config/database';
import { metaService } from '../meta/meta.service';

// Extended Request interface
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
    // First try default account
    let account = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        status: 'CONNECTED',
        isDefault: true,
      },
      select: { id: true },
    });

    // If no default, get any connected account
    if (!account) {
      account = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    }

    return account?.id;
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

      console.log('📝 Creating template:', {
        organizationId,
        name: input.name,
        whatsappAccountId: input.whatsappAccountId,
      });

      // If no whatsappAccountId provided, use default
      if (!input.whatsappAccountId) {
        input.whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      const template = await templatesService.create(organizationId, input);

      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template,
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

      // Parse query params safely
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = req.query.status as TemplateStatus | undefined;
      const category = req.query.category as TemplateCategory | undefined;
      const language = (req.query.language as string)?.trim() || undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      console.log('📋 Fetching templates:', {
        organizationId,
        page,
        limit,
        search,
        status,
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

      return res.json({
        success: true,
        message: 'Template fetched successfully',
        data: template,
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

      return res.json({
        success: true,
        message: 'Template updated successfully',
        data: template,
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

      return res.json({
        success: true,
        message: result.message,
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

      return res.status(201).json({
        success: true,
        message: 'Template duplicated successfully',
        data: template,
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

      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      const stats = await templatesService.getStats(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: 'Stats fetched successfully',
        data: stats,
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

      return res.json({
        success: true,
        message: 'Preview generated successfully',
        data: preview,
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

      // If no account specified, use default
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // If still no account, return empty array
      if (!whatsappAccountId) {
        return res.json({
          success: true,
          message: 'No WhatsApp account connected',
          data: [],
        });
      }

      const templates = await templatesService.getApprovedTemplates(
        organizationId,
        whatsappAccountId
      );

      return res.json({
        success: true,
        message: 'Approved templates fetched successfully',
        data: templates,
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

      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      const languages = await templatesService.getLanguages(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: 'Languages fetched successfully',
        data: languages,
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

      const { whatsappAccountId } = req.body;

      const result = await templatesService.submitToMeta(organizationId, id, whatsappAccountId);

      return res.json({
        success: true,
        message: result.message,
        data: result,
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

      // If no account specified, use default
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // If still no account, return error
      if (!whatsappAccountId) {
        return res.status(400).json({
          success: false,
          message: 'No WhatsApp account connected. Please connect a WhatsApp account first.',
        });
      }

      console.log('🔄 Syncing templates for account:', whatsappAccountId);

      const result = await templatesService.syncFromMeta(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CHECK WHATSAPP CONNECTION
  // ==========================================
  async checkConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      // Check for any WhatsApp accounts
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
        select: {
          id: true,
          phoneNumber: true,
          displayName: true,
          status: true,
          isDefault: true,
          wabaId: true,
          createdAt: true,
          tokenExpiresAt: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      if (accounts.length === 0) {
        return res.json({
          success: false,
          message: 'No WhatsApp accounts found',
          hasConnection: false,
          accounts: [],
          connectedCount: 0,
          totalCount: 0,
        });
      }

      // Check which accounts are truly connected
      const accountsWithStatus = await Promise.all(
        accounts.map(async (account) => {
          let canDecrypt = false;
          let isExpired = false;

          try {
            const result = await metaService.getAccountWithToken(account.id);
            canDecrypt = !!result;
          } catch (err) {
            // Silent fail
          }

          if (account.tokenExpiresAt) {
            isExpired = account.tokenExpiresAt < new Date();
          }

          return {
            ...account,
            canDecrypt,
            isExpired,
            isReady: account.status === 'CONNECTED' && canDecrypt && !isExpired,
          };
        })
      );

      const connectedAccounts = accountsWithStatus.filter(a => a.isReady);
      const defaultAccount = accountsWithStatus.find(a => a.isDefault);

      return res.json({
        success: true,
        hasConnection: connectedAccounts.length > 0,
        defaultAccount: defaultAccount || connectedAccounts[0] || null,
        accounts: accountsWithStatus,
        connectedCount: connectedAccounts.length,
        totalCount: accounts.length,
      });
    } catch (error: any) {
      console.error('❌ Error checking connection:', error.message);
      next(error);
    }
  }
}

export const templatesController = new TemplatesController();
export default templatesController;