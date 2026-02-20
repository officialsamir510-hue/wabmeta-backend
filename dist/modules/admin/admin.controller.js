"use strict";
// src/modules/admin/admin.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const admin_service_1 = require("./admin.service");
const errorHandler_1 = require("../../middleware/errorHandler");
// ============================================
// RESPONSE HELPERS
// ============================================
const sendSuccess = (res, data, message, statusCode = 200, meta) => {
    const response = {
        success: true,
        message,
        data,
    };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};
const sendError = (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};
// ============================================
// HELPER FUNCTIONS
// ============================================
const parseQueryString = (value) => {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};
const parseQueryNumber = (value, defaultValue) => {
    const parsed = Number(value);
    return !isNaN(parsed) && parsed > 0 ? parsed : defaultValue;
};
const getParamId = (id) => {
    if (Array.isArray(id)) {
        return id[0];
    }
    return id || '';
};
// ============================================
// ADMIN CONTROLLER CLASS
// ============================================
class AdminController {
    // ==========================================
    // ADMIN AUTH
    // ==========================================
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                throw new errorHandler_1.AppError('Email and password are required', 400);
            }
            const result = await admin_service_1.adminService.login({ email, password });
            // Store admin user info for frontend
            return res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token: result.token,
                    admin: result.admin,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getProfile(req, res, next) {
        try {
            if (!req.admin?.id) {
                throw new errorHandler_1.AppError('Admin not authenticated', 401);
            }
            const admin = await admin_service_1.adminService.getAdminById(req.admin.id);
            if (!admin) {
                throw new errorHandler_1.AppError('Admin not found', 404);
            }
            return sendSuccess(res, admin, 'Profile fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DASHBOARD
    // ==========================================
    async getDashboardStats(req, res, next) {
        try {
            const stats = await admin_service_1.adminService.getDashboardStats();
            return sendSuccess(res, stats, 'Dashboard stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // USER MANAGEMENT
    // ==========================================
    async getUsers(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 20);
            const search = parseQueryString(req.query.search);
            const status = parseQueryString(req.query.status);
            const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
            const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';
            const result = await admin_service_1.adminService.getUsers({
                page,
                limit,
                search,
                status,
                sortBy,
                sortOrder,
            });
            return sendSuccess(res, result.users, 'Users fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserById(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.getUserById(id);
            if (!user) {
                throw new errorHandler_1.AppError('User not found', 404);
            }
            return sendSuccess(res, user, 'User fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.updateUser(id, req.body);
            return sendSuccess(res, user, 'User updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUserStatus(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            const { status } = req.body;
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            if (!status) {
                throw new errorHandler_1.AppError('Status is required', 400);
            }
            const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING_VERIFICATION'];
            if (!validStatuses.includes(status.toUpperCase())) {
                throw new errorHandler_1.AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
            }
            const user = await admin_service_1.adminService.updateUserStatus(id, status.toUpperCase());
            return sendSuccess(res, user, `User status updated to ${status}`);
        }
        catch (error) {
            next(error);
        }
    }
    async suspendUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.suspendUser(id);
            return sendSuccess(res, user, 'User suspended successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async activateUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.activateUser(id);
            return sendSuccess(res, user, 'User activated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const result = await admin_service_1.adminService.deleteUser(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ORGANIZATION MANAGEMENT
    // ==========================================
    async getOrganizations(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 20);
            const search = parseQueryString(req.query.search);
            const planType = parseQueryString(req.query.planType);
            const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
            const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';
            const result = await admin_service_1.adminService.getOrganizations({
                page,
                limit,
                search,
                planType,
                sortBy,
                sortOrder,
            });
            return sendSuccess(res, result.organizations, 'Organizations fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getOrganizationById(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const org = await admin_service_1.adminService.getOrganizationById(id);
            if (!org) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            return sendSuccess(res, org, 'Organization fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateOrganization(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const org = await admin_service_1.adminService.updateOrganization(id, req.body);
            return sendSuccess(res, org, 'Organization updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteOrganization(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await admin_service_1.adminService.deleteOrganization(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async updateSubscription(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await admin_service_1.adminService.updateSubscription(id, req.body);
            return sendSuccess(res, result, 'Subscription updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // PLAN MANAGEMENT
    // ==========================================
    async getPlans(req, res, next) {
        try {
            const plans = await admin_service_1.adminService.getPlans();
            return sendSuccess(res, plans, 'Plans fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async createPlan(req, res, next) {
        try {
            const plan = await admin_service_1.adminService.createPlan(req.body);
            return sendSuccess(res, plan, 'Plan created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async updatePlan(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Plan ID is required', 400);
            }
            const plan = await admin_service_1.adminService.updatePlan(id, req.body);
            return sendSuccess(res, plan, 'Plan updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deletePlan(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Plan ID is required', 400);
            }
            const result = await admin_service_1.adminService.deletePlan(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ADMIN MANAGEMENT
    // ==========================================
    async getAdmins(req, res, next) {
        try {
            const admins = await admin_service_1.adminService.getAdmins();
            return sendSuccess(res, admins, 'Admins fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async createAdmin(req, res, next) {
        try {
            const admin = await admin_service_1.adminService.createAdmin(req.body);
            return sendSuccess(res, admin, 'Admin created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async updateAdmin(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Admin ID is required', 400);
            }
            const admin = await admin_service_1.adminService.updateAdmin(id, req.body);
            return sendSuccess(res, admin, 'Admin updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteAdmin(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Admin ID is required', 400);
            }
            // Prevent self-deletion
            if (req.admin?.id === id) {
                throw new errorHandler_1.AppError('Cannot delete your own admin account', 400);
            }
            const result = await admin_service_1.adminService.deleteAdmin(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ACTIVITY LOGS
    // ==========================================
    async getActivityLogs(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 50);
            const action = parseQueryString(req.query.action);
            const userId = parseQueryString(req.query.userId);
            const organizationId = parseQueryString(req.query.organizationId);
            const startDate = parseQueryString(req.query.startDate);
            const endDate = parseQueryString(req.query.endDate);
            const result = await admin_service_1.adminService.getActivityLogs({
                page,
                limit,
                action,
                userId,
                organizationId,
                startDate,
                endDate,
            });
            return sendSuccess(res, result.logs, 'Activity logs fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SYSTEM SETTINGS
    // ==========================================
    async getSystemSettings(req, res, next) {
        try {
            const settings = admin_service_1.adminService.getSystemSettings();
            return sendSuccess(res, settings, 'Settings fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateSystemSettings(req, res, next) {
        try {
            const settings = admin_service_1.adminService.updateSystemSettings(req.body);
            return sendSuccess(res, settings, 'Settings updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
//# sourceMappingURL=admin.controller.js.map