import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth'; // Fixed path

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getDashboardStats.bind(dashboardController));
router.get('/quick-stats', dashboardController.getQuickStats.bind(dashboardController));
router.get('/chart-data', dashboardController.getChartData.bind(dashboardController));
router.get('/widgets', dashboardController.getWidgets.bind(dashboardController));

export default router;