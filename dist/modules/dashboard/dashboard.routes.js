"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("./dashboard.controller");
const auth_1 = require("../../middleware/auth"); // Fixed path
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/stats', dashboard_controller_1.dashboardController.getDashboardStats.bind(dashboard_controller_1.dashboardController));
router.get('/quick-stats', dashboard_controller_1.dashboardController.getQuickStats.bind(dashboard_controller_1.dashboardController));
router.get('/chart-data', dashboard_controller_1.dashboardController.getChartData.bind(dashboard_controller_1.dashboardController));
router.get('/widgets', dashboard_controller_1.dashboardController.getWidgets.bind(dashboard_controller_1.dashboardController));
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map