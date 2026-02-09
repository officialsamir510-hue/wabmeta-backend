// src/modules/whatsapp/whatsapp.controller.ts

import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class WhatsAppController {
  static async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      
      console.log('📱 Fetching WhatsApp accounts for org:', organizationId);

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      const accounts = await whatsappService.getAccounts(organizationId);
      console.log('✅ Accounts found:', accounts?.length || 0);

      return res.json({ 
        success: true, 
        data: accounts || [] 
      });
    } catch (error) {
      console.error('❌ getAccounts error:', error);
      next(error);
    }
  }

  static async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      const account = await whatsappService.getAccountById(id, organizationId);

      if (!account) {
        return res.status(404).json({ 
          success: false, 
          message: 'WhatsApp account not found' 
        });
      }

      return res.json({ 
        success: true, 
        data: account 
      });
    } catch (error) {
      console.error('❌ getAccount error:', error);
      next(error);
    }
  }

  static async connect(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { code, redirectUri } = req.body;

      console.log('🔗 Connecting WhatsApp account...');

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Authorization code required' 
        });
      }

      const account = await whatsappService.connectAccount(
        organizationId,
        code,
        redirectUri
      );

      console.log('✅ WhatsApp account connected:', account.id);

      return res.json({ 
        success: true, 
        data: account,
        message: 'WhatsApp account connected successfully'
      });
    } catch (error: any) {
      console.error('❌ connect error:', error);
      
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to connect WhatsApp account'
      });
    }
  }

  static async disconnect(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      await whatsappService.disconnectAccount(id, organizationId);

      return res.json({ 
        success: true, 
        message: 'WhatsApp account disconnected successfully' 
      });
    } catch (error) {
      console.error('❌ disconnect error:', error);
      next(error);
    }
  }

  static async setDefault(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      const account = await whatsappService.setDefaultAccount(id, organizationId);

      return res.json({ 
        success: true, 
        data: account,
        message: 'Default account updated successfully'
      });
    } catch (error) {
      console.error('❌ setDefault error:', error);
      next(error);
    }
  }

  static async sendText(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { whatsappAccountId, to, message } = req.body;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      if (!whatsappAccountId || !to || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'whatsappAccountId, to, and message are required' 
        });
      }

      const result = await whatsappService.sendTextMessage(
        whatsappAccountId,
        organizationId,
        to,
        message
      );

      return res.json({ 
        success: true, 
        data: result 
      });
    } catch (error) {
      console.error('❌ sendText error:', error);
      next(error);
    }
  }

  static async sendTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { whatsappAccountId, to, templateName, templateLanguage, components } = req.body;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      if (!whatsappAccountId || !to || !templateName) {
        return res.status(400).json({ 
          success: false, 
          message: 'whatsappAccountId, to, and templateName are required' 
        });
      }

      const result = await whatsappService.sendTemplateMessage(
        whatsappAccountId,
        organizationId,
        to,
        templateName,
        templateLanguage || 'en',
        components || []
      );

      return res.json({ 
        success: true, 
        data: result 
      });
    } catch (error) {
      console.error('❌ sendTemplate error:', error);
      next(error);
    }
  }

  static async syncTemplates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { whatsappAccountId } = req.body;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      if (!whatsappAccountId) {
        return res.status(400).json({ 
          success: false, 
          message: 'whatsappAccountId is required' 
        });
      }

      const result = await whatsappService.syncTemplates(whatsappAccountId, organizationId);

      return res.json({ 
        success: true, 
        data: result,
        message: 'Templates synced successfully'
      });
    } catch (error) {
      console.error('❌ syncTemplates error:', error);
      next(error);
    }
  }

  static async getTemplates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization ID required' 
        });
      }

      const templates = await whatsappService.getTemplates(id, organizationId);

      return res.json({ 
        success: true, 
        data: templates 
      });
    } catch (error) {
      console.error('❌ getTemplates error:', error);
      next(error);
    }
  }
}