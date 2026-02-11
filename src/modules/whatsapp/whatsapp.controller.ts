// src/modules/whatsapp/whatsapp.controller.ts

import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { successResponse, errorResponse } from '../../utils/response';

class WhatsAppController {
  /**
   * Send text message
   */
  async sendText(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, text, conversationId } = req.body;

      if (!accountId || !to || !text) {
        return errorResponse(res, 'Account ID, recipient, and text are required', 400);
      }

      const result = await whatsappService.sendTextMessage(
        accountId,
        to,
        text,
        conversationId
      );

      return successResponse(res, {
        data: result,
        message: 'Message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send template message
   */
  async sendTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, templateName, templateLanguage, components, conversationId } =
        req.body;

      if (!accountId || !to || !templateName) {
        return errorResponse(
          res,
          'Account ID, recipient, and template name are required',
          400
        );
      }

      const result = await whatsappService.sendTemplateMessage({
        accountId,
        to,
        templateName,
        templateLanguage: templateLanguage || 'en',
        components,
        conversationId,
      });

      return successResponse(res, {
        data: result,
        message: 'Template message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send media message
   */
  async sendMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, to, mediaType, mediaUrl, caption, conversationId } = req.body;

      if (!accountId || !to || !mediaType || !mediaUrl) {
        return errorResponse(
          res,
          'Account ID, recipient, media type, and media URL are required',
          400
        );
      }

      const result = await whatsappService.sendMediaMessage(
        accountId,
        to,
        mediaType,
        mediaUrl,
        caption,
        conversationId
      );

      return successResponse(res, {
        data: result,
        message: 'Media message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, messageId } = req.body;

      if (!accountId || !messageId) {
        return errorResponse(res, 'Account ID and message ID are required', 400);
      }

      const result = await whatsappService.markAsRead(accountId, messageId);

      return successResponse(res, {
        data: result,
        message: 'Message marked as read',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();
export default whatsappController;