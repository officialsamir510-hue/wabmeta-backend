// src/modules/whatsapp/whatsapp.routes.ts

import { Router } from 'express';
import { dashboardController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/quick-stats', dashboardController.getQuickStats);
router.get('/chart-data', dashboardController.getChartData);

export default router;