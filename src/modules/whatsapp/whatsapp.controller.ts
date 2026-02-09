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
  // GET /api/v1/whatsapp/accounts
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const accounts = await whatsappService.getAccounts(organizationId);
      
      // Return proper array structure
      return res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/whatsapp/connect (OAuth)
  async connectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { code, redirectUri } = req.body;
      const account = await whatsappService.connectAccount(organizationId, code, redirectUri);

      return res.json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/whatsapp/accounts/:id
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params;
      await whatsappService.disconnectAccount(organizationId, id);

      return res.json({ success: true, message: 'Account disconnected' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/whatsapp/accounts/:id/default
  async setDefaultAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params;
      await whatsappService.setDefaultAccount(organizationId, id);

      return res.json({ success: true, message: 'Default account updated' });
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();