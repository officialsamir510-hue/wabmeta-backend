// src/modules/whatsapp/whatsapp.controller.ts

import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class WhatsAppController {
  // ==========================================
  // WEBHOOK VERIFICATION (GET)
  // ==========================================
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = whatsappService.verifyWebhook(mode, token, challenge);

    if (result) {
      console.log('✅ Webhook verified successfully');
      return res.status(200).send(result);
    } else {
      console.log('❌ Webhook verification failed');
      return res.sendStatus(403);
    }
  }

  // ==========================================
  // WEBHOOK HANDLER (POST)
  // ==========================================
  async handleWebhook(req: Request, res: Response) {
    // Always respond with 200 immediately to acknowledge receipt
    res.sendStatus(200);

    // Process webhook asynchronously
    try {
      await whatsappService.processWebhook(req.body);
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  }

  // ==========================================
  // CONNECT ACCOUNT
  // ==========================================
  async connectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { code, redirectUri } = req.body;
      const account = await whatsappService.connectAccount(organizationId, code, redirectUri);
      return sendSuccess(res, account, 'WhatsApp account connected successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DISCONNECT ACCOUNT
  // ==========================================
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const result = await whatsappService.disconnectAccount(organizationId, id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ACCOUNTS
  // ==========================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const accounts = await whatsappService.getAccounts(organizationId);
      return sendSuccess(res, accounts, 'Accounts fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ACCOUNT BY ID
  // ==========================================
  async getAccountById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const account = await whatsappService.getAccountById(organizationId, id);
      return sendSuccess(res, account, 'Account fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SET DEFAULT ACCOUNT
  // ==========================================
  async setDefaultAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const account = await whatsappService.setDefaultAccount(organizationId, id);
      return sendSuccess(res, account, 'Default account updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND TEXT MESSAGE
  // ==========================================
  async sendTextMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { whatsappAccountId, to, text, replyToMessageId } = req.body;
      const result = await whatsappService.sendTextMessage(
        organizationId,
        whatsappAccountId,
        to,
        text,
        replyToMessageId
      );

      if (result.success) {
        return sendSuccess(res, result, 'Message sent successfully');
      } else {
        throw new AppError(result.error || 'Failed to send message', 400);
      }
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND TEMPLATE MESSAGE
  // ==========================================
  async sendTemplateMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { whatsappAccountId, to, templateName, languageCode, components } = req.body;
      const result = await whatsappService.sendTemplateMessage(
        organizationId,
        whatsappAccountId,
        to,
        templateName,
        languageCode,
        components
      );

      if (result.success) {
        return sendSuccess(res, result, 'Template message sent successfully');
      } else {
        throw new AppError(result.error || 'Failed to send template message', 400);
      }
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND MEDIA MESSAGE
  // ==========================================
  async sendMediaMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { whatsappAccountId, to, type, mediaUrl, caption, filename } = req.body;
      const result = await whatsappService.sendMediaMessage(
        organizationId,
        whatsappAccountId,
        to,
        type,
        mediaUrl,
        caption,
        filename
      );

      if (result.success) {
        return sendSuccess(res, result, 'Media message sent successfully');
      } else {
        throw new AppError(result.error || 'Failed to send media message', 400);
      }
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND INTERACTIVE MESSAGE
  // ==========================================
  async sendInteractiveMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { 
        whatsappAccountId, 
        to, 
        interactiveType, 
        bodyText,
        headerText,
        footerText,
        buttons,
        buttonText,
        sections
      } = req.body;
      
      const result = await whatsappService.sendInteractiveMessage(
        organizationId,
        whatsappAccountId,
        to,
        interactiveType,
        bodyText,
        { headerText, footerText, buttons, buttonText, sections }
      );

      if (result.success) {
        return sendSuccess(res, result, 'Interactive message sent successfully');
      } else {
        throw new AppError(result.error || 'Failed to send interactive message', 400);
      }
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SYNC TEMPLATES
  // ==========================================
  async syncTemplates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { whatsappAccountId } = req.body;
      const result = await whatsappService.syncTemplates(organizationId, whatsappAccountId);
      return sendSuccess(res, result, `Synced ${result.synced} new templates, updated ${result.updated} existing`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET MEDIA URL
  // ==========================================
  async getMediaUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { mediaId } = req.params;
      const { whatsappAccountId } = req.query;
      const result = await whatsappService.getMediaUrl(
        organizationId,
        whatsappAccountId as string,
        mediaId
      );
      return sendSuccess(res, result, 'Media URL fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const whatsappController = new WhatsAppController();