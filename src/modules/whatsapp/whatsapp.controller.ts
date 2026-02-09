import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class WhatsAppController {
  static setDefaultAccount(arg0: string, setDefaultAccount: any) {
      throw new Error('Method not implemented.');
  }
  static connectAccount(arg0: string, connectAccount: any) {
      throw new Error('Method not implemented.');
  }
  static getAccounts(arg0: string, getAccounts: any) {
      throw new Error('Method not implemented.');
  }
  
  // GET /api/v1/whatsapp/accounts
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      console.log('📱 Fetching WhatsApp accounts for org:', organizationId);

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      const accounts = await whatsappService.getAccounts(organizationId);
      console.log('✅ Accounts found:', accounts?.length || 0);

      return res.json({ success: true, data: accounts || [] });
    } catch (error) {
      console.error('❌ getAccounts error:', error);
      next(error);
    }
  }

  // GET /api/v1/whatsapp/accounts/:id
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      const account = await whatsappService.getAccountById(organizationId, id);
      return res.json({ success: true, data: account });
    } catch (error) {
      console.error('❌ getAccount error:', error);
      next(error);
    }
  }

  // POST /api/v1/whatsapp/connect
  async connectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { code, redirectUri } = req.body;

      console.log('🔗 Connecting WhatsApp account...');

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      if (!code) {
        return res.status(400).json({ success: false, message: 'Authorization code required' });
      }

      const account = await whatsappService.connectAccount(organizationId, code, redirectUri);
      console.log('✅ WhatsApp account connected:', account.id);

      return res.json({ 
        success: true, 
        data: account,
        message: 'WhatsApp account connected successfully'
      });
    } catch (error: any) {
      console.error('❌ connectAccount error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to connect WhatsApp account'
      });
    }
  }

  // DELETE /api/v1/whatsapp/accounts/:id
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      await whatsappService.disconnectAccount(organizationId, id);
      return res.json({ success: true, message: 'WhatsApp account disconnected successfully' });
    } catch (error) {
      console.error('❌ disconnectAccount error:', error);
      next(error);
    }
  }

  // POST /api/v1/whatsapp/accounts/:id/default
  async setDefaultAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      const result = await whatsappService.setDefaultAccount(organizationId, id);
      return res.json({ success: true, message: 'Default account updated successfully', data: result });
    } catch (error) {
      console.error('❌ setDefaultAccount error:', error);
      next(error);
    }
  }

  // POST /api/v1/whatsapp/send/text
  async sendText(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { whatsappAccountId, to, message } = req.body;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      const result = await whatsappService.sendTextMessage(organizationId, whatsappAccountId, to, message);
      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('❌ sendText error:', error);
      next(error);
    }
  }

  // POST /api/v1/whatsapp/send/template
  async sendTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const { whatsappAccountId, to, templateName, templateLanguage, components } = req.body;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization ID required' });
      }

      const result = await whatsappService.sendTemplateMessage(
        organizationId,
        whatsappAccountId,
        to,
        templateName,
        templateLanguage || 'en',
        components || []
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('❌ sendTemplate error:', error);
      next(error);
    }
  }
}

// ✅ Export Instance
export const whatsappController = new WhatsAppController();