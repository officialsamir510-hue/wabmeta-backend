// src/modules/dashboard/dashboard.controller.ts (NEW FILE)

import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { sendSuccess, sendError } from '../../utils/response';

export class DashboardController {
  
  async getDashboardStats(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return sendError(res, 'Organization not found', 400);
      }

      const stats = await dashboardService.getDashboardStats(userId, organizationId);
      
      return sendSuccess(res, stats, 'Dashboard stats fetched successfully');
    } catch (error: any) {
      console.error('Dashboard stats error:', error);
      return sendError(res, error.message || 'Failed to fetch dashboard stats', 500);
    }
  }

  async getQuickStats(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return sendError(res, 'Organization not found', 400);
      }

      const stats = await dashboardService.getQuickStats(organizationId);
      
      return sendSuccess(res, stats, 'Quick stats fetched successfully');
    } catch (error: any) {
      console.error('Quick stats error:', error);
      return sendError(res, error.message || 'Failed to fetch quick stats', 500);
    }
  }
}

export const dashboardController = new DashboardController();