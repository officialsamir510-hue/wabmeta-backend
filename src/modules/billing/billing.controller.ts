// src/modules/billing/billing.controller.ts

import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { UpgradePlanInput } from './billing.types';

interface AuthRequest extends Request {
  user?: { id: string; email: string; organizationId?: string };
}

export class BillingController {
  async getCurrentPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const data = await billingService.getCurrentPlan(organizationId);
      return sendSuccess(res, data, 'Current plan fetched');
    } catch (e) {
      next(e);
    }
  }

  async getUsage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const data = await billingService.getUsageStats(organizationId);
      return sendSuccess(res, data, 'Usage fetched');
    } catch (e) {
      next(e);
    }
  }

  async getPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const data = await billingService.getAvailablePlans(organizationId);
      return sendSuccess(res, data, 'Plans fetched');
    } catch (e) {
      next(e);
    }
  }

  async upgrade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) throw new AppError('Auth required', 401);

      const input: UpgradePlanInput = req.body;
      const data = await billingService.upgradePlan(organizationId, userId, input);
      return sendSuccess(res, data, data.message);
    } catch (e) {
      next(e);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) throw new AppError('Auth required', 401);

      const data = await billingService.cancelSubscription(organizationId, userId);
      return sendSuccess(res, data, data.message);
    } catch (e) {
      next(e);
    }
  }

  async getInvoices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await billingService.getInvoices(organizationId, page, limit);
      return res.json({
        success: true,
        message: 'Invoices fetched',
        data: result.invoices,
        meta: { total: result.total, page, limit },
      });
    } catch (e) {
      next(e);
    }
  }

  async getPaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const data = await billingService.getPaymentMethods(organizationId);
      return sendSuccess(res, data, 'Payment methods fetched');
    } catch (e) {
      next(e);
    }
  }

  async addPaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const data = await billingService.addPaymentMethod(organizationId, req.body);
      return sendSuccess(res, data, 'Payment method added', 201);
    } catch (e) {
      next(e);
    }
  }

  async deletePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const id = req.params.id as string;
      const data = await billingService.deletePaymentMethod(organizationId, id);
      return sendSuccess(res, data, data.message);
    } catch (e) {
      next(e);
    }
  }

  async setDefaultPaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const id = req.params.id as string;
      const data = await billingService.setDefaultPaymentMethod(organizationId, id);
      return sendSuccess(res, data, data.message);
    } catch (e) {
      next(e);
    }
  }
}

export const billingController = new BillingController();