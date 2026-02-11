"use strict";
// src/modules/admin/admin.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const admin_service_1 = require("./admin.service");
// Response helper
const sendSuccess = (res, data, message, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, data });
};
class AdminController {
    // ==========================================
    // ADMIN AUTH
    // ==========================================
    async login(req, res, next) {
        try {
            const result = await admin_service_1.adminService.login(req.body);
            return sendSuccess(res, result, 'Login successful');
        }
        catch (error) {
            next(error);
        }
    }
    async getProfile(req, res, next) {
        try {
            const admins = await admin_service_1.adminService.getAdmins();
            const admin = admins.find((a) => a.id === req.admin?.id);
            return sendSuccess(res, admin, 'Profile fetched');
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
            const admin = await admin_service_1.adminService.updateAdmin(req.params.id, req.body);
            return sendSuccess(res, admin, 'Admin updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async getAdmins(req, res, next) {
        try {
            const admins = await admin_service_1.adminService.getAdmins();
            return sendSuccess(res, admins, 'Admins fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteAdmin(req, res, next) {
        try {
            const result = await admin_service_1.adminService.deleteAdmin(req.params.id);
            return sendSuccess(res, result, result.message);
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
            return sendSuccess(res, stats, 'Dashboard stats fetched');
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
            // ✅ Fix: Access query params safely
            const q = req.query;
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 20;
            const search = typeof q.search === 'string' ? q.search : undefined;
            const status = typeof q.status === 'string' ? q.status : undefined;
            const sortBy = typeof q.sortBy === 'string' ? q.sortBy : 'createdAt';
            const sortOrder = typeof q.sortOrder === 'string' ? q.sortOrder : 'desc';
            const result = await admin_service_1.adminService.getUsers({ page, limit, search, status, sortBy, sortOrder });
            return res.json({
                success: true,
                message: 'Users fetched successfully',
                data: result.users,
                meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserById(req, res, next) {
        try {
            const user = await admin_service_1.adminService.getUserById(req.params.id);
            return sendSuccess(res, user, 'User fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUser(req, res, next) {
        try {
            const user = await admin_service_1.adminService.updateUser(req.params.id, req.body);
            return sendSuccess(res, user, 'User updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteUser(req, res, next) {
        try {
            const result = await admin_service_1.adminService.deleteUser(req.params.id);
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async suspendUser(req, res, next) {
        try {
            const user = await admin_service_1.adminService.suspendUser(req.params.id);
            return sendSuccess(res, user, 'User suspended successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async activateUser(req, res, next) {
        try {
            const user = await admin_service_1.adminService.activateUser(req.params.id);
            return sendSuccess(res, user, 'User activated successfully');
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
            // ✅ Fix: Access query params safely
            const q = req.query;
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 20;
            const search = typeof q.search === 'string' ? q.search : undefined;
            const planType = typeof q.planType === 'string' ? q.planType : undefined;
            const sortBy = typeof q.sortBy === 'string' ? q.sortBy : 'createdAt';
            const sortOrder = typeof q.sortOrder === 'string' ? q.sortOrder : 'desc';
            const result = await admin_service_1.adminService.getOrganizations({ page, limit, search, planType, sortBy, sortOrder });
            return res.json({
                success: true,
                message: 'Organizations fetched successfully',
                data: result.organizations,
                meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getOrganizationById(req, res, next) {
        try {
            const org = await admin_service_1.adminService.getOrganizationById(req.params.id);
            return sendSuccess(res, org, 'Organization fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateOrganization(req, res, next) {
        try {
            const org = await admin_service_1.adminService.updateOrganization(req.params.id, req.body);
            return sendSuccess(res, org, 'Organization updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteOrganization(req, res, next) {
        try {
            const result = await admin_service_1.adminService.deleteOrganization(req.params.id);
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async updateSubscription(req, res, next) {
        try {
            const org = await admin_service_1.adminService.updateSubscription(req.params.id, req.body);
            return sendSuccess(res, org, 'Subscription updated successfully');
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
            const plan = await admin_service_1.adminService.updatePlan(req.params.id, req.body);
            return sendSuccess(res, plan, 'Plan updated successfully');
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
            // ✅ Fix: Access query params safely
            const q = req.query;
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 50;
            const action = typeof q.action === 'string' ? q.action : undefined;
            const userId = typeof q.userId === 'string' ? q.userId : undefined;
            const organizationId = typeof q.organizationId === 'string' ? q.organizationId : undefined;
            const startDate = typeof q.startDate === 'string' ? q.startDate : undefined;
            const endDate = typeof q.endDate === 'string' ? q.endDate : undefined;
            const result = await admin_service_1.adminService.getActivityLogs({ page, limit, action, userId, organizationId, startDate, endDate });
            return res.json({
                success: true,
                message: 'Activity logs fetched',
                data: result.logs,
                meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
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