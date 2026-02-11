"use strict";
// src/modules/dashboard/dashboard.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const dashboard_service_1 = require("./dashboard.service");
class DashboardController {
    async getDashboardStats(req, res, next) {
        try {
            const userId = req.user.id;
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization context required'
                });
            }
            const stats = await dashboard_service_1.dashboardService.getDashboardStats(userId, organizationId);
            return res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getQuickStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization context required'
                });
            }
            const stats = await dashboard_service_1.dashboardService.getQuickStats(organizationId);
            return res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getChartData(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const days = parseInt(req.query.days) || 7;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization context required'
                });
            }
            const chartData = await dashboard_service_1.dashboardService.getChartData(organizationId, days);
            return res.json({
                success: true,
                data: chartData
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ✅ NEW: Get widgets data
    async getWidgets(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const days = parseInt(req.query.days) || 7;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization context required'
                });
            }
            const widgets = await dashboard_service_1.dashboardService.getWidgetsData(organizationId, days);
            return res.json({
                success: true,
                data: widgets
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ✅ NEW: Get recent activity
    async getRecentActivity(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const limit = parseInt(req.query.limit) || 10;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization context required'
                });
            }
            const activity = await dashboard_service_1.dashboardService.getRecentActivity(organizationId, limit);
            return res.json({
                success: true,
                data: activity
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
//# sourceMappingURL=dashboard.controller.js.map