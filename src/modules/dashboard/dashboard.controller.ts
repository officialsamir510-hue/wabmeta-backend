import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class DashboardController {
  // Existing
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await dashboardService.getDashboardStats(userId, organizationId);
      return res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // Existing
  async getQuickStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await dashboardService.getQuickStats(organizationId);
      return res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // Existing
  async getChartData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const days = parseInt(String(req.query.days || '7')) || 7;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const chartData = await dashboardService.getChartData(organizationId, days);
      return res.json({ success: true, data: chartData });
    } catch (error) {
      next(error);
    }
  }

  // ✅ NEW: Widgets Endpoint (All dashboard charts in one call)
  async getWidgets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const days = Math.min(Math.max(parseInt(String(req.query.days || '7')), 7), 90);

      const data = await dashboardService.getDashboardWidgets(organizationId, days);
      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }
}

export const dashboardController = new DashboardController();