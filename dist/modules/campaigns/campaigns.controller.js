"use strict";
// 📁 src/modules/campaigns/campaigns.controller.ts - COMPLETE FINAL VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignsController = exports.CampaignsController = exports.csvUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const campaigns_service_1 = require("./campaigns.service");
const campaigns_upload_service_1 = require("./campaigns.upload.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
// ==========================================
// MULTER CONFIGURATION FOR CSV UPLOAD
// ==========================================
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (req, file, cb) => {
        const isCSV = file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.csv');
        if (isCSV) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});
exports.csvUpload = upload.single('file');
// ==========================================
// CAMPAIGNS CONTROLLER CLASS
// ==========================================
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
            console.log('📦 Creating campaign:', {
                organizationId,
                userId: req.user.id,
                name: input.name,
            });
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
                search: req.query.search ? String(req.query.search) : undefined,
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            const input = req.body;
            console.log('📝 Updating campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            console.log('🗑️ Deleting campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            console.log('🚀 Starting campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            console.log('⏸️ Pausing campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            console.log('▶️ Resuming campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            console.log('❌ Cancelling campaign:', { id, organizationId });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            const { retryFailed = true, retryPending = false } = req.body;
            console.log('🔄 Retrying campaign messages:', {
                id,
                organizationId,
                retryFailed,
                retryPending,
            });
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            const { name } = req.body;
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                throw new errorHandler_1.AppError('Campaign name is required', 400);
            }
            console.log('📋 Duplicating campaign:', { id, newName: name });
            const campaign = await campaigns_service_1.campaignsService.duplicate(organizationId, id, name.trim());
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
            const id = String(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Campaign ID is required', 400);
            }
            const analytics = await campaigns_service_1.campaignsService.getAnalytics(organizationId, id);
            return (0, response_1.sendSuccess)(res, analytics, 'Analytics fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: UPLOAD CSV CONTACTS
    // ==========================================
    async uploadContacts(req, res, next) {
        try {
            const userId = req.user.id;
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            if (!req.file) {
                throw new errorHandler_1.AppError('CSV file is required', 400);
            }
            console.log('📤 Processing CSV upload:', {
                userId,
                organizationId,
                filename: req.file.originalname,
                size: req.file.size,
            });
            const result = await campaigns_upload_service_1.campaignUploadService.processCsvFile(req.file.buffer, userId, organizationId);
            console.log('✅ CSV processed successfully:', {
                total: result.totalRows,
                successful: result.validRows,
                failed: result.invalidRows,
            });
            return (0, response_1.sendSuccess)(res, result, 'CSV processed successfully');
        }
        catch (error) {
            console.error('❌ CSV upload error:', error);
            // Handle multer errors
            if (error.message === 'Only CSV files are allowed') {
                return next(new errorHandler_1.AppError('Only CSV files are allowed', 400));
            }
            if (error.code === 'LIMIT_FILE_SIZE') {
                return next(new errorHandler_1.AppError('File size exceeds 5MB limit', 400));
            }
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: GET CSV UPLOAD TEMPLATE
    // ==========================================
    async getUploadTemplate(req, res, next) {
        try {
            const template = campaigns_upload_service_1.campaignUploadService.getTemplateHeaders();
            return (0, response_1.sendSuccess)(res, {
                headers: template,
                example: {
                    phone: '+911234567890',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    tags: 'customer,premium',
                },
                instructions: [
                    'Phone number is required',
                    'Use international format with country code (e.g., +911234567890)',
                    'Tags should be comma-separated',
                    'All other fields are optional',
                ],
            }, 'CSV template fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: VALIDATE CSV FILE
    // ==========================================
    async validateCsvFile(req, res, next) {
        try {
            if (!req.file) {
                throw new errorHandler_1.AppError('CSV file is required', 400);
            }
            console.log('🔍 Validating CSV file:', {
                filename: req.file.originalname,
                size: req.file.size,
            });
            const validation = await campaigns_upload_service_1.campaignUploadService.validateCsvFile(req.file.buffer);
            return (0, response_1.sendSuccess)(res, validation, 'CSV validation completed');
        }
        catch (error) {
            console.error('❌ CSV validation error:', error);
            if (error.message === 'Only CSV files are allowed') {
                return next(new errorHandler_1.AppError('Only CSV files are allowed', 400));
            }
            next(error);
        }
    }
}
exports.CampaignsController = CampaignsController;
// ==========================================
// EXPORT SINGLETON INSTANCE
// ==========================================
exports.campaignsController = new CampaignsController();
//# sourceMappingURL=campaigns.controller.js.map