"use strict";
// src/modules/dashboard/dashboard.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("./dashboard.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Dashboard endpoints
router.get('/stats', dashboard_controller_1.dashboardController.getStats);
router.get('/widgets', dashboard_controller_1.dashboardController.getWidgets);
router.get('/activity', dashboard_controller_1.dashboardController.getActivity);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map