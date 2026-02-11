// src/modules/meta/meta.controller.ts

import { Request, Response, NextFunction } from 'express';
import { metaService } from './meta.service';
import { successResponse, errorResponse } from '../../utils/response';
import { v4 as uuidv4 } from 'uuid';

// Helper function to safely get string from params/query
const getString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};

class MetaController {
  /**
   * Get Embedded Signup config
   */
  async getEmbeddedConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = metaService.getEmbeddedSignupConfig();
      
      return successResponse(res, {
        data: config,
        message: 'Embedded signup config retrieved',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate OAuth URL (alternative flow)
   */
  async getOAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.query.organizationId);
      
      if (!organizationId) {
        return errorResponse(res, 'Organization ID required', 400);
      }

      // Create state with org ID for callback
      const state = Buffer.from(
        JSON.stringify({
          organizationId,
          userId: req.user!.id,
          nonce: uuidv4(),
        })
      ).toString('base64');

      const url = metaService.getOAuthUrl(state);

      return successResponse(res, {
        data: { url, state },
        message: 'OAuth URL generated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback / Complete connection
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, organizationId } = req.body;

      if (!code || !organizationId) {
        return errorResponse(res, 'Code and organization ID are required', 400);
      }

      // Verify user has access to organization
      const hasAccess = await this.verifyOrgAccess(req.user!.id, String(organizationId));
      if (!hasAccess) {
        return errorResponse(res, 'You do not have access to this organization', 403);
      }

      const result = await metaService.completeConnection(
        String(code),
        String(organizationId),
        req.user!.id
      );

      if (!result.success) {
        return errorResponse(res, result.error || 'Connection failed', 400);
      }

      return successResponse(res, {
        data: { account: result.account },
        message: 'WhatsApp account connected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all WhatsApp accounts for organization
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const accounts = await metaService.getAccounts(organizationId);

      return successResponse(res, {
        data: { accounts },
        message: 'Accounts retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single account
   */
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const account = await metaService.getAccount(accountId, organizationId);

      return successResponse(res, {
        data: { account },
        message: 'Account retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect account
   */
  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      await metaService.disconnectAccount(accountId, organizationId);

      return successResponse(res, {
        message: 'Account disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set default account
   */
  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      await metaService.setDefaultAccount(accountId, organizationId);

      return successResponse(res, {
        message: 'Default account updated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh account health
   */
  async refreshHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const health = await metaService.refreshAccountHealth(accountId, organizationId);

      return successResponse(res, {
        data: health,
        message: 'Health check completed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync templates
   */
  async syncTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const result = await metaService.syncTemplates(accountId, organizationId);

      return successResponse(res, {
        data: result,
        message: 'Templates synced successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  private async verifyOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return !!member;
  }
}

export const metaController = new MetaController();
export default metaController;