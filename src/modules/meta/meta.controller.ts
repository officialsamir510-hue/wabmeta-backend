import { Request, Response, NextFunction } from 'express';
import { metaService } from './meta.service';
import { successResponse, errorResponse } from '../../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to safely get string from params/query
const getString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};

class MetaController {
  async getEmbeddedConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = metaService.getEmbeddedSignupConfig();
      return successResponse(res, { data: cfg, message: 'Embedded signup config retrieved' });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = metaService.getIntegrationStatus();
      return successResponse(res, { data: status, message: 'Meta integration status' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generates URL like:
   * https://www.facebook.com/v21.0/dialog/oauth?...&config_id=...&override_default_response_type=true
   */
  async getOAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const orgFromQuery = getString(req.query.organizationId);
      const orgFromUser = (req.user as any)?.organizationId; // if your auth middleware attaches it
      const organizationId = orgFromQuery || orgFromUser;

      if (!organizationId) {
        return errorResponse(res, 'Organization ID required', 400);
      }

      // Create state (base64 JSON)
      const state = Buffer.from(
        JSON.stringify({
          organizationId,
          userId: req.user!.id,
          nonce: uuidv4(),
          timestamp: Date.now(),
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

  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, organizationId } = req.body;

      if (!code || !organizationId) {
        return errorResponse(res, 'Code and organization ID are required', 400);
      }

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

  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const accounts = await metaService.getAccounts(organizationId);

      return successResponse(res, {
        data: { accounts },
        message: 'Accounts retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const account = await metaService.getAccount(accountId, organizationId);

      return successResponse(res, {
        data: { account },
        message: 'Account retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      await metaService.disconnectAccount(accountId, organizationId);

      return successResponse(res, { message: 'Account disconnected successfully' });
    } catch (error) {
      next(error);
    }
  }

  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      await metaService.setDefaultAccount(accountId, organizationId);

      return successResponse(res, { message: 'Default account updated' });
    } catch (error) {
      next(error);
    }
  }

  async refreshHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const health = await metaService.refreshAccountHealth(accountId, organizationId);

      return successResponse(res, {
        data: health,
        message: 'Health check completed',
      });
    } catch (error) {
      next(error);
    }
  }

  async syncTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

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
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
    return !!member;
  }
}

export const metaController = new MetaController();
export default metaController;