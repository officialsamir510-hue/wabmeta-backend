"use strict";
// src/modules/billing/billing.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingController = void 0;
const billing_service_1 = require("./billing.service");
const response_1 = require("../../utils/response");
class BillingController {
    // ============================================
    // GET SUBSCRIPTION
    // ============================================
    async getSubscription(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const subscription = await billing_service_1.billingService.getSubscription(organizationId);
            return (0, response_1.sendSuccess)(res, subscription, 'Subscription retrieved successfully');
        }
        catch (error) {
            console.error('Get subscription error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get subscription', 500);
        }
    }
    // ============================================
    // GET PLANS
    // ============================================
    async getPlans(req, res) {
        try {
            const plans = await billing_service_1.billingService.getPlans();
            return (0, response_1.sendSuccess)(res, plans, 'Plans retrieved successfully');
        }
        catch (error) {
            console.error('Get plans error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get plans', 500);
        }
    }
    // ============================================
    // GET USAGE
    // ============================================
    async getUsage(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const usage = await billing_service_1.billingService.getUsage(organizationId);
            return (0, response_1.sendSuccess)(res, usage, 'Usage retrieved successfully');
        }
        catch (error) {
            console.error('Get usage error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get usage', 500);
        }
    }
    // ============================================
    // CREATE RAZORPAY ORDER
    // ============================================
    async createRazorpayOrder(req, res) {
        try {
            const { planKey, billingCycle = 'monthly' } = req.body;
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                return (0, response_1.errorResponse)(res, 'User not authenticated', 401);
            }
            if (!planKey) {
                return (0, response_1.errorResponse)(res, 'Plan key is required', 400);
            }
            const order = await billing_service_1.billingService.createRazorpayOrder({
                organizationId,
                userId,
                planKey,
                billingCycle: billingCycle
            });
            return (0, response_1.sendSuccess)(res, order, 'Order created successfully');
        }
        catch (error) {
            console.error('Create Razorpay order error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create order', 500);
        }
    }
    // ============================================
    // VERIFY RAZORPAY PAYMENT
    // ============================================
    async verifyRazorpayPayment(req, res) {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                return (0, response_1.errorResponse)(res, 'User not authenticated', 401);
            }
            const result = await billing_service_1.billingService.verifyRazorpayPayment({
                organizationId,
                userId,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            });
            return (0, response_1.sendSuccess)(res, result, 'Payment verified successfully');
        }
        catch (error) {
            console.error('Verify payment error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Payment verification failed', 500);
        }
    }
    // ============================================
    // UPGRADE PLAN
    // ============================================
    async upgradePlan(req, res) {
        try {
            const { planType, billingCycle } = req.body;
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const subscription = await billing_service_1.billingService.upgradePlan({
                organizationId,
                planType,
                billingCycle
            });
            return (0, response_1.sendSuccess)(res, subscription, 'Plan upgraded successfully');
        }
        catch (error) {
            console.error('Upgrade plan error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to upgrade plan', 500);
        }
    }
    // ============================================
    // CANCEL SUBSCRIPTION
    // ============================================
    async cancelSubscription(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            const { reason } = req.body;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const result = await billing_service_1.billingService.cancelSubscription(organizationId, reason);
            return (0, response_1.sendSuccess)(res, result, 'Subscription cancelled successfully');
        }
        catch (error) {
            console.error('Cancel subscription error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to cancel subscription', 500);
        }
    }
    // ============================================
    // RESUME SUBSCRIPTION
    // ============================================
    async resumeSubscription(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const result = await billing_service_1.billingService.resumeSubscription(organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Subscription resumed successfully');
        }
        catch (error) {
            console.error('Resume subscription error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to resume subscription', 500);
        }
    }
    // ============================================
    // GET INVOICES
    // ============================================
    async getInvoices(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            const { limit = 10, offset = 0 } = req.query;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const invoices = await billing_service_1.billingService.getInvoices(organizationId, Number(limit), Number(offset));
            return (0, response_1.sendSuccess)(res, invoices, 'Invoices retrieved successfully');
        }
        catch (error) {
            console.error('Get invoices error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get invoices', 500);
        }
    }
    // ============================================
    // GET SINGLE INVOICE
    // ============================================
    async getInvoice(req, res) {
        try {
            const { id } = req.params;
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const invoice = await billing_service_1.billingService.getInvoice(id, organizationId);
            return (0, response_1.sendSuccess)(res, invoice, 'Invoice retrieved successfully');
        }
        catch (error) {
            console.error('Get invoice error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get invoice', 500);
        }
    }
    // ============================================
    // DOWNLOAD INVOICE
    // ============================================
    async downloadInvoice(req, res) {
        try {
            const { id } = req.params;
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const pdfBuffer = await billing_service_1.billingService.generateInvoicePDF(id, organizationId);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
                'Content-Length': pdfBuffer.length
            });
            return res.send(pdfBuffer);
        }
        catch (error) {
            console.error('Download invoice error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to download invoice', 500);
        }
    }
}
exports.billingController = new BillingController();
//# sourceMappingURL=billing.controller.js.map