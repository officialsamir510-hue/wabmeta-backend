"use strict";
// src/modules/billing/billing.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const billing_controller_1 = require("./billing.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET
router.get('/plan', billing_controller_1.billingController.getCurrentPlan.bind(billing_controller_1.billingController));
router.get('/usage', billing_controller_1.billingController.getUsage.bind(billing_controller_1.billingController));
router.get('/plans', billing_controller_1.billingController.getPlans.bind(billing_controller_1.billingController));
router.get('/invoices', billing_controller_1.billingController.getInvoices.bind(billing_controller_1.billingController));
router.get('/payment-methods', billing_controller_1.billingController.getPaymentMethods.bind(billing_controller_1.billingController));
// POST/DELETE
router.post('/upgrade', billing_controller_1.billingController.upgrade.bind(billing_controller_1.billingController));
router.post('/cancel', billing_controller_1.billingController.cancel.bind(billing_controller_1.billingController));
router.post('/payment-methods', billing_controller_1.billingController.addPaymentMethod.bind(billing_controller_1.billingController));
router.delete('/payment-methods/:id', billing_controller_1.billingController.deletePaymentMethod.bind(billing_controller_1.billingController));
router.post('/payment-methods/:id/default', billing_controller_1.billingController.setDefaultPaymentMethod.bind(billing_controller_1.billingController));
exports.default = router;
//# sourceMappingURL=billing.routes.js.map