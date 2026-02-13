import { Request, Response, NextFunction } from 'express';
import { PrismaClient, WhatsAppAccountStatus } from '@prisma/client';
import { whatsappService } from './whatsapp.service';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

const getOrgId = (req: Request): string | null => {
  const headerOrg =
    (req.header('X-Organization-Id') || req.header('x-organization-id'))?.trim() || '';

  const queryOrg =
    (typeof req.query.organizationId === 'string' ? req.query.organizationId : '')?.trim() || '';

  // optional fallback if your auth middleware attaches organizationId
  const userOrg = (req.user as any)?.organizationId?.trim?.() || '';

  return headerOrg || queryOrg || userOrg || null;
};

const sanitizeAccount = (account: any) => {
  const { accessToken, webhookSecret, ...safe } = account;
  return {
    ...safe,
    hasAccessToken: !!accessToken,
  };
};

const verifyOrgAccess = async (userId: string, organizationId: string): Promise<boolean> => {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
  return !!member;
};

class WhatsAppController {
  // ==========================================================
  // ✅ ACCOUNTS APIs (Fixes GET /whatsapp/accounts 404)
  // ==========================================================

  /**
   * GET /api/v1/whatsapp/accounts
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      if (!organizationId) {
        return errorResponse(res, 'Organization context missing. Send X-Organization-Id header.', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) return errorResponse(res, 'Unauthorized', 403);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return successResponse(res, {
        data: accounts.map(sanitizeAccount),
        message: 'WhatsApp accounts retrieved',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/whatsapp/accounts/:accountId
   */
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'Organization context missing. Send X-Organization-Id header.', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) return errorResponse(res, 'Unauthorized', 403);

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });

      if (!account) return errorResponse(res, 'Account not found', 404);

      return successResponse(res, {
        data: sanitizeAccount(account),
        message: 'WhatsApp account retrieved',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/whatsapp/accounts/:accountId/default
   */
  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'Organization context missing. Send X-Organization-Id header.', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) return errorResponse(res, 'Unauthorized', 403);

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });
      if (!account) return errorResponse(res, 'Account not found', 404);

      await prisma.whatsAppAccount.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      });

      const updated = await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });

      return successResponse(res, {
        data: sanitizeAccount(updated),
        message: 'Default WhatsApp account updated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/whatsapp/accounts/:accountId
   */
  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'Organization context missing. Send X-Organization-Id header.', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) return errorResponse(res, 'Unauthorized', 403);

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });
      if (!account) return errorResponse(res, 'Account not found', 404);

      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: WhatsAppAccountStatus.DISCONNECTED,
          accessToken: null,
          tokenExpiresAt: null,
          isDefault: false,
        },
      });

      // if it was default, set another connected as default
      if (account.isDefault) {
        const another = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
            id: { not: accountId },
            status: WhatsAppAccountStatus.CONNECTED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (another) {
          await prisma.whatsAppAccount.update({
            where: { id: another.id },
            data: { isDefault: true },
          });
        }
      }

      return successResponse(res, {
        message: 'WhatsApp account disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================
  // Existing SEND APIs (aapka original code)
  // ==========================================================

  async sendText(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, text, conversationId } = req.body;

      if (!accountId || !to || !text) {
        return errorResponse(res, 'Account ID, recipient, and text are required', 400);
      }

      const result = await whatsappService.sendTextMessage(accountId, to, text, conversationId);

      return successResponse(res, { data: result, message: 'Message sent successfully' });
    } catch (error) {
      next(error);
    }
  }

  async sendTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, templateName, templateLanguage, components, conversationId } = req.body;

      if (!accountId || !to || !templateName) {
        return errorResponse(res, 'Account ID, recipient, and template name are required', 400);
      }

      const result = await whatsappService.sendTemplateMessage({
        accountId,
        to,
        templateName,
        templateLanguage: templateLanguage || 'en',
        components,
        conversationId,
      });

      return successResponse(res, { data: result, message: 'Template message sent successfully' });
    } catch (error) {
      next(error);
    }
  }

  async sendMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, mediaType, mediaUrl, caption, conversationId } = req.body;

      if (!accountId || !to || !mediaType || !mediaUrl) {
        return errorResponse(res, 'Account ID, recipient, media type, and media URL are required', 400);
      }

      const result = await whatsappService.sendMediaMessage(
        accountId,
        to,
        mediaType,
        mediaUrl,
        caption,
        conversationId
      );

      return successResponse(res, { data: result, message: 'Media message sent successfully' });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, messageId } = req.body;

      if (!accountId || !messageId) {
        return errorResponse(res, 'Account ID and message ID are required', 400);
      }

      const result = await whatsappService.markAsRead(accountId, messageId);

      return successResponse(res, { data: result, message: 'Message marked as read' });
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();
export default whatsappController;