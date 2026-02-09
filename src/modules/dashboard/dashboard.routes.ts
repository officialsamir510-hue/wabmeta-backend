// src/modules/dashboard/dashboard.routes.ts

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Dashboard stats
router.get('/stats', (req, res, next) => dashboardController.getDashboardStats(req, res, next));

// Quick stats
router.get('/quick-stats', (req, res, next) => dashboardController.getQuickStats(req, res, next));

// Chart data
router.get('/charts/:type', (req, res, next) => dashboardController.getChartData(req, res, next));

// ✅ NEW: Widgets endpoint
router.get('/widgets', (req, res, next) => dashboardController.getWidgets(req, res, next));

// ✅ NEW: Recent activity
router.get('/activity', (req, res, next) => dashboardController.getRecentActivity(req, res, next));

export default router;