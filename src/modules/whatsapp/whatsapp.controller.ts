// src/modules/dashboard/dashboard.controller.ts

import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../dashboard/dashboard.service';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class DashboardController {
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Organization context required'
        });
      }

      const stats = await dashboardService.getDashboardStats(userId, organizationId);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuickStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Organization context required'
        });
      }

      const stats = await dashboardService.getQuickStats(organizationId);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async getChartData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const days = parseInt(req.query.days as string) || 7;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Organization context required'
        });
      }

      const chartData = await dashboardService.getChartData(organizationId, days);

      return res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();