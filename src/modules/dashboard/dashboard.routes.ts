// src/modules/dashboard/dashboard.routes.ts

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Dashboard endpoints
router.get('/stats', dashboardController.getStats);
router.get('/widgets', dashboardController.getWidgets);
router.get('/activity', dashboardController.getActivity);

export default router;