// src/modules/admin/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';

// Response helper
const sendSuccess = (res: Response, data: any, message: string, statusCode: number = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

interface AdminRequest extends Request {
  admin?: { id: string; email: string; role: string };
}

export class AdminController {
  // ==========================================
  // ADMIN AUTH
  // ==========================================
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.login(req.body);
      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.getAdmins();
      const admin = admins.find((a) => a.id === req.admin?.id);
      return sendSuccess(res, admin, 'Profile fetched');
    } catch (error) {
      next(error);
    }
  }

  async createAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admin = await adminService.createAdmin(req.body);
      return sendSuccess(res, admin, 'Admin created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admin = await adminService.updateAdmin(req.params.id, req.body);
      return sendSuccess(res, admin, 'Admin updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdmins(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.getAdmins();
      return sendSuccess(res, admins, 'Admins fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteAdmin(req.params.id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboardStats(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats();
      return sendSuccess(res, stats, 'Dashboard stats fetched');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================
  async getUsers(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      // ✅ Fix: Access query params safely
      const q = req.query;
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 20;
      const search = typeof q.search === 'string' ? q.search : undefined;
      const status = typeof q.status === 'string' ? q.status : undefined;
      const sortBy = typeof q.sortBy === 'string' ? q.sortBy : 'createdAt';
      const sortOrder = typeof q.sortOrder === 'string' ? q.sortOrder : 'desc';

      const result = await adminService.getUsers({ page, limit, search, status, sortBy, sortOrder });
      
      return res.json({
        success: true,
        message: 'Users fetched successfully',
        data: result.users,
        meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const user = await adminService.getUserById(req.params.id);
      return sendSuccess(res, user, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const user = await adminService.updateUser(req.params.id, req.body);
      return sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteUser(req.params.id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const user = await adminService.suspendUser(req.params.id);
      return sendSuccess(res, user, 'User suspended successfully');
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const user = await adminService.activateUser(req.params.id);
      return sendSuccess(res, user, 'User activated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ORGANIZATION MANAGEMENT
  // ==========================================
  async getOrganizations(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      // ✅ Fix: Access query params safely
      const q = req.query;
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 20;
      const search = typeof q.search === 'string' ? q.search : undefined;
      const planType = typeof q.planType === 'string' ? q.planType : undefined;
      const sortBy = typeof q.sortBy === 'string' ? q.sortBy : 'createdAt';
      const sortOrder = typeof q.sortOrder === 'string' ? q.sortOrder : 'desc';

      const result = await adminService.getOrganizations({ page, limit, search, planType, sortBy, sortOrder });
      
      return res.json({
        success: true,
        message: 'Organizations fetched successfully',
        data: result.organizations,
        meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrganizationById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const org = await adminService.getOrganizationById(req.params.id);
      return sendSuccess(res, org, 'Organization fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const org = await adminService.updateOrganization(req.params.id, req.body);
      return sendSuccess(res, org, 'Organization updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteOrganization(req.params.id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const org = await adminService.updateSubscription(req.params.id, req.body);
      return sendSuccess(res, org, 'Subscription updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================
  async getPlans(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const plans = await adminService.getPlans();
      return sendSuccess(res, plans, 'Plans fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const plan = await adminService.createPlan(req.body);
      return sendSuccess(res, plan, 'Plan created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const plan = await adminService.updatePlan(req.params.id, req.body);
      return sendSuccess(res, plan, 'Plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  async getActivityLogs(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      // ✅ Fix: Access query params safely
      const q = req.query;
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 50;
      const action = typeof q.action === 'string' ? q.action : undefined;
      const userId = typeof q.userId === 'string' ? q.userId : undefined;
      const organizationId = typeof q.organizationId === 'string' ? q.organizationId : undefined;
      const startDate = typeof q.startDate === 'string' ? q.startDate : undefined;
      const endDate = typeof q.endDate === 'string' ? q.endDate : undefined;

      const result = await adminService.getActivityLogs({ page, limit, action, userId, organizationId, startDate, endDate });
      
      return res.json({
        success: true,
        message: 'Activity logs fetched',
        data: result.logs,
        meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================
  async getSystemSettings(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const settings = adminService.getSystemSettings();
      return sendSuccess(res, settings, 'Settings fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSystemSettings(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const settings = adminService.updateSystemSettings(req.body);
      return sendSuccess(res, settings, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();