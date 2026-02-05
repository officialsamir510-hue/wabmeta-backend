// src/modules/admin/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  AdminLoginInput,
  CreateAdminInput,
  UpdateAdminInput,
  UsersQueryInput,
  UpdateUserInput,
  OrganizationsQueryInput,
  UpdateOrganizationInput,
  UpdateSubscriptionInput,
  CreatePlanInput,
  UpdatePlanInput,
  SystemSettingsInput,
} from './admin.types';

interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

export class AdminController {
  // ==========================================
  // ADMIN AUTH
  // ==========================================
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input: AdminLoginInput = req.body;
      const result = await adminService.login(input);
      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.getAdmins();
      const admin = admins.find((a) => a.id === req.admin!.id);
      return sendSuccess(res, admin, 'Profile fetched');
    } catch (error) {
      next(error);
    }
  }

  async createAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const input: CreateAdminInput = req.body;
      const admin = await adminService.createAdmin(input);
      return sendSuccess(res, admin, 'Admin created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input: UpdateAdminInput = req.body;
      const admin = await adminService.updateAdmin(id, input);
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
      const { id } = req.params;
      const result = await adminService.deleteAdmin(id);
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
      const query: UsersQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await adminService.getUsers(query);
      return res.json({
        success: true,
        message: 'Users fetched successfully',
        data: result.users,
        meta: {
          total: result.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await adminService.getUserById(id);
      return sendSuccess(res, user, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input: UpdateUserInput = req.body;
      const user = await adminService.updateUser(id, input);
      return sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteUser(id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await adminService.suspendUser(id);
      return sendSuccess(res, user, 'User suspended successfully');
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await adminService.activateUser(id);
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
      const query: OrganizationsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        planType: req.query.planType as any,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await adminService.getOrganizations(query);
      return res.json({
        success: true,
        message: 'Organizations fetched successfully',
        data: result.organizations,
        meta: {
          total: result.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrganizationById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const org = await adminService.getOrganizationById(id);
      return sendSuccess(res, org, 'Organization fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input: UpdateOrganizationInput = req.body;
      const org = await adminService.updateOrganization(id, input);
      return sendSuccess(res, org, 'Organization updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteOrganization(id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input: UpdateSubscriptionInput = req.body;
      const org = await adminService.updateSubscription(id, input);
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
      const input: CreatePlanInput = req.body;
      const plan = await adminService.createPlan(input);
      return sendSuccess(res, plan, 'Plan created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input: UpdatePlanInput = req.body;
      const plan = await adminService.updatePlan(id, input);
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
      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        action: req.query.action as string,
        userId: req.query.userId as string,
        organizationId: req.query.organizationId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await adminService.getActivityLogs(query);
      return res.json({
        success: true,
        message: 'Activity logs fetched',
        data: result.logs,
        meta: {
          total: result.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(result.total / query.limit),
        },
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
      const input: SystemSettingsInput = req.body;
      const settings = adminService.updateSystemSettings(input);
      return sendSuccess(res, settings, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const adminController = new AdminController();