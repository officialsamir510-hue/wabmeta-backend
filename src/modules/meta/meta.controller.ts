// 📁 src/modules/meta/meta.controller.ts - COMPLETE FIXED VERSION

import { Request, Response, NextFunction } from 'express';
import { metaService } from './meta.service';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { generateToken } from '../../utils/otp';

// Helper to safely get organization ID from headers
const getOrgId = (req: Request): string => {
  const header = req.headers['x-organization-id'];
  if (!header) return '';
  return Array.isArray(header) ? header[0] : header;
};

export class MetaController {
  // ============================================
  // GET OAUTH URL
  // ============================================
  async getOAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;

      if (!organizationId || typeof organizationId !== 'string') {
        throw new AppError('Organization ID is required', 400);
      }

      // Verify user has access to this organization
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to connect WhatsApp', 403);
      }

      // Generate secure state token
      const stateToken = generateToken();
      const state = `${organizationId}:${stateToken}`;

      // Store state in database (expires in 10 minutes)
      // Cast prisma to any to support new model until client regenerates
      await (prisma as any).oAuthState.create({
        data: {
          state,
          organizationId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      // Clean up expired states
      await (prisma as any).oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      const url = metaService.getOAuthUrl(state);

      console.log('📱 OAuth URL generated for organization:', organizationId);

      return sendSuccess(res, { url, state }, 'OAuth URL generated');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET AUTH URL (Alias for frontend compatibility)
  // ============================================
  async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    return this.getOAuthUrl(req, res, next);
  }

  // ============================================
  // HANDLE CALLBACK (Code Exchange)
  // ============================================
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;

      console.log('\n🔄 ========== META CALLBACK ==========');
      console.log('   Code received:', code ? 'Yes' : 'No');
      console.log('   State received:', state ? 'Yes' : 'No');

      if (!code) {
        throw new AppError('Authorization code is required', 400);
      }

      // Get organization ID from state or request
      let organizationId: string;

      if (state) {
        // Verify state token
        const storedState = await (prisma as any).oAuthState.findUnique({
          where: { state },
        });

        if (!storedState) {
          throw new AppError('Invalid or expired state token', 400);
        }

        if (storedState.expiresAt < new Date()) {
          await (prisma as any).oAuthState.delete({ where: { state } });
          throw new AppError('State token expired. Please try again.', 400);
        }

        organizationId = storedState.organizationId;

        // Delete used state
        await (prisma as any).oAuthState.delete({ where: { state } });
      } else if (req.body.organizationId) {
        organizationId = req.body.organizationId;
      } else {
        throw new AppError('Organization ID is required', 400);
      }

      console.log('   Organization ID:', organizationId);

      // Verify user has access
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to connect WhatsApp', 403);
      }

      // Complete the connection
      const result = await metaService.completeConnection(
        code,
        organizationId,
        userId,
        (progress) => {
          console.log(`📊 ${progress.step}: ${progress.message}`);
        }
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to connect WhatsApp account', 500);
      }

      console.log('✅ Meta callback successful');
      console.log('🔄 ========== META CALLBACK END ==========\n');

      return sendSuccess(
        res,
        { account: result.account },
        'WhatsApp account connected successfully'
      );
    } catch (error) {
      console.error('❌ Meta callback error:', error);
      next(error);
    }
  }

  // ============================================
  // CONNECT (Direct token/code submission)
  // ============================================
  async connect(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, accessToken, organizationId } = req.body;

      const codeOrToken = accessToken || code;

      if (!codeOrToken) {
        throw new AppError('Authorization code or access token is required', 400);
      }

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      // Verify user has access
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to connect WhatsApp', 403);
      }

      // Complete the connection
      const result = await metaService.completeConnection(
        codeOrToken,
        organizationId,
        userId,
        (progress) => {
          console.log(`📊 ${progress.step}: ${progress.message}`);
        }
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to connect WhatsApp account', 500);
      }

      return sendSuccess(
        res,
        { account: result.account },
        'WhatsApp account connected successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET ACCOUNTS
  // ============================================
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const accounts = await metaService.getAccounts(organizationId);

      return sendSuccess(res, accounts, 'Accounts fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await metaService.getAccount(id, organizationId);

      return sendSuccess(res, account, 'Account fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      // Verify user has access
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to disconnect', 403);
      }

      const result = await metaService.disconnectAccount(id, organizationId);

      return sendSuccess(res, result, 'Account disconnected');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SET DEFAULT ACCOUNT
  // ============================================
  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await metaService.setDefaultAccount(id, organizationId);

      return sendSuccess(res, result, 'Default account updated');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // REFRESH ACCOUNT HEALTH
  // ============================================
  async refreshHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await metaService.refreshAccountHealth(id, organizationId);

      return sendSuccess(res, result, 'Health check completed');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SYNC TEMPLATES
  // ============================================
  async syncTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await metaService.syncTemplates(id, organizationId);

      return sendSuccess(res, result, 'Templates synced');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET ORGANIZATION STATUS
  // ============================================
  async getOrganizationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.params.organizationId as string;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const accounts = await prisma.whatsAppAccount.findMany({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
      });

      const status = accounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';

      return sendSuccess(res, {
        status,
        connectedCount: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          phoneNumber: a.phoneNumber,
          displayName: a.displayName,
          isDefault: a.isDefault,
        })),
      }, 'Data fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET EMBEDDED SIGNUP CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = metaService.getEmbeddedSignupConfig();

      return sendSuccess(res, config, 'Config fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET INTEGRATION STATUS
  // ============================================
  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = metaService.getIntegrationStatus();

      return sendSuccess(res, status, 'Integration status');
    } catch (error) {
      next(error);
    }
  }
}

export const metaController = new MetaController();
export default metaController;