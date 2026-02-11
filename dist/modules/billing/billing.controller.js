"use strict";
// src/modules/billing/billing.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingController = exports.BillingController = void 0;
const billing_service_1 = require("./billing.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class BillingController {
    async getCurrentPlan(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const data = await billing_service_1.billingService.getCurrentPlan(organizationId);
            return (0, response_1.sendSuccess)(res, data, 'Current plan fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async getUsage(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const data = await billing_service_1.billingService.getUsageStats(organizationId);
            return (0, response_1.sendSuccess)(res, data, 'Usage fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async getPlans(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const data = await billing_service_1.billingService.getAvailablePlans(organizationId);
            return (0, response_1.sendSuccess)(res, data, 'Plans fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async upgrade(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId)
                throw new errorHandler_1.AppError('Auth required', 401);
            const input = req.body;
            const data = await billing_service_1.billingService.upgradePlan(organizationId, userId, input);
            return (0, response_1.sendSuccess)(res, data, data.message);
        }
        catch (e) {
            next(e);
        }
    }
    async cancel(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId)
                throw new errorHandler_1.AppError('Auth required', 401);
            const data = await billing_service_1.billingService.cancelSubscription(organizationId, userId);
            return (0, response_1.sendSuccess)(res, data, data.message);
        }
        catch (e) {
            next(e);
        }
    }
    async getInvoices(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const result = await billing_service_1.billingService.getInvoices(organizationId, page, limit);
            return res.json({
                success: true,
                message: 'Invoices fetched',
                data: result.invoices,
                meta: { total: result.total, page, limit },
            });
        }
        catch (e) {
            next(e);
        }
    }
    async getPaymentMethods(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const data = await billing_service_1.billingService.getPaymentMethods(organizationId);
            return (0, response_1.sendSuccess)(res, data, 'Payment methods fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async addPaymentMethod(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const data = await billing_service_1.billingService.addPaymentMethod(organizationId, req.body);
            return (0, response_1.sendSuccess)(res, data, 'Payment method added', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async deletePaymentMethod(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const id = req.params.id;
            const data = await billing_service_1.billingService.deletePaymentMethod(organizationId, id);
            return (0, response_1.sendSuccess)(res, data, data.message);
        }
        catch (e) {
            next(e);
        }
    }
    async setDefaultPaymentMethod(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const id = req.params.id;
            const data = await billing_service_1.billingService.setDefaultPaymentMethod(organizationId, id);
            return (0, response_1.sendSuccess)(res, data, data.message);
        }
        catch (e) {
            next(e);
        }
    }
}
exports.BillingController = BillingController;
exports.billingController = new BillingController();
//# sourceMappingURL=billing.controller.js.map