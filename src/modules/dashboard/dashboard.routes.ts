// src/modules/dashboard/dashboard.routes.ts (NEW FILE)

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/dashboard/stats - Get full dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

// GET /api/dashboard/quick-stats - Get quick stats for header
router.get('/quick-stats', dashboardController.getQuickStats);

export default router;