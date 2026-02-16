"use strict";
// src/modules/campaigns/campaigns.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignsController = exports.CampaignsController = void 0;
const campaigns_service_1 = require("./campaigns.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class CampaignsController {
    // ==========================================
    // CREATE CAMPAIGN
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const campaign = await campaigns_service_1.campaignsService.create(organizationId, req.user.id, input);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CAMPAIGNS LIST
    // ==========================================
    async getList(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                status: req.query.status,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await campaigns_service_1.campaignsService.getList(organizationId, query);
            return res.json({
                success: true,
                message: 'Campaigns fetched successfully',
                data: result.campaigns,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CAMPAIGN BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const campaign = await campaigns_service_1.campaignsService.getById(organizationId, id);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE CAMPAIGN
    // ==========================================
    async update(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const input = req.body;
            const campaign = await campaigns_service_1.campaignsService.update(organizationId, id, input);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE CAMPAIGN
    // ==========================================
    async delete(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const result = await campaigns_service_1.campaignsService.delete(organizationId, id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // START CAMPAIGN
    // ==========================================
    async start(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const campaign = await campaigns_service_1.campaignsService.start(organizationId, id);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign started successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // PAUSE CAMPAIGN
    // ==========================================
    async pause(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const campaign = await campaigns_service_1.campaignsService.pause(organizationId, id);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign paused successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // RESUME CAMPAIGN
    // ==========================================
    async resume(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const campaign = await campaigns_service_1.campaignsService.resume(organizationId, id);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign resumed successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // CANCEL CAMPAIGN
    // ==========================================
    async cancel(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const campaign = await campaigns_service_1.campaignsService.cancel(organizationId, id);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign cancelled successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CAMPAIGN CONTACTS
    // ==========================================
    async getContacts(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50,
                status: req.query.status,
            };
            const result = await campaigns_service_1.campaignsService.getContacts(organizationId, id, query);
            return res.json({
                success: true,
                message: 'Campaign contacts fetched successfully',
                data: result.contacts,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // RETRY FAILED MESSAGES
    // ==========================================
    async retry(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const { retryFailed, retryPending } = req.body;
            const result = await campaigns_service_1.campaignsService.retry(organizationId, id, retryFailed, retryPending);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DUPLICATE CAMPAIGN
    // ==========================================
    async duplicate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const { name } = req.body;
            const campaign = await campaigns_service_1.campaignsService.duplicate(organizationId, id, name);
            return (0, response_1.sendSuccess)(res, campaign, 'Campaign duplicated successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CAMPAIGN STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await campaigns_service_1.campaignsService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CAMPAIGN ANALYTICS
    // ==========================================
    async getAnalytics(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const analytics = await campaigns_service_1.campaignsService.getAnalytics(organizationId, id);
            return (0, response_1.sendSuccess)(res, analytics, 'Analytics fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CampaignsController = CampaignsController;
// Export singleton instance
exports.campaignsController = new CampaignsController();
//# sourceMappingURL=campaigns.controller.js.map