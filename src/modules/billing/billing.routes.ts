// src/modules/billing/billing.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { billingController } from './billing.controller';

const router = Router();
router.use(authenticate);

// GET
router.get('/plan', billingController.getCurrentPlan.bind(billingController));
router.get('/usage', billingController.getUsage.bind(billingController));
router.get('/plans', billingController.getPlans.bind(billingController));
router.get('/invoices', billingController.getInvoices.bind(billingController));
router.get('/payment-methods', billingController.getPaymentMethods.bind(billingController));

// POST/DELETE
router.post('/upgrade', billingController.upgrade.bind(billingController));
router.post('/cancel', billingController.cancel.bind(billingController));

router.post('/payment-methods', billingController.addPaymentMethod.bind(billingController));
router.delete('/payment-methods/:id', billingController.deletePaymentMethod.bind(billingController));
router.post('/payment-methods/:id/default', billingController.setDefaultPaymentMethod.bind(billingController));

export default router;