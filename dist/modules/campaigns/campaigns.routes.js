"use strict";
// 📁 src/modules/campaigns/campaigns.routes.ts - COMPLETE WITH CSV UPLOAD
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaigns_controller_1 = require("./campaigns.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const response_1 = require("../../utils/response");
const planLimits_1 = require("../../middleware/planLimits");
const campaigns_schema_1 = require("./campaigns.schema");
const router = (0, express_1.Router)();
// ============================================
// MIDDLEWARE
// ============================================
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// STATISTICS & ANALYTICS (Must be before :id routes)
// ============================================
/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics for organization
 * @access  Private
 */
router.get('/stats', campaigns_controller_1.campaignsController.getStats.bind(campaigns_controller_1.campaignsController));
// ============================================
// CSV UPLOAD ROUTES (Must be before :id routes)
// ============================================
/**
 * @route   POST /api/v1/campaigns/upload-contacts
 * @desc    Upload CSV and create contacts
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post('/upload-contacts', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.uploadContacts.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/upload-template
 * @desc    Get CSV upload template format
 * @access  Private
 */
router.get('/upload-template', campaigns_controller_1.campaignsController.getUploadTemplate.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/upload-validate
 * @desc    Validate CSV file without importing
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post('/upload-validate', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.validateCsvFile.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN CRUD ROUTES
// ============================================
/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post('/', planLimits_1.checkCampaignLimit, (0, validate_1.validate)(campaigns_schema_1.createCampaignSchema), campaigns_controller_1.campaignsController.create.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns list with pagination
 * @access  Private
 */
router.get('/', (0, validate_1.validate)(campaigns_schema_1.getCampaignsSchema), campaigns_controller_1.campaignsController.getList.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get('/:id', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getById.bind(campaigns_controller_1.campaignsController));
/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign (only DRAFT or SCHEDULED)
 * @access  Private
 */
router.put('/:id', (0, validate_1.validate)(campaigns_schema_1.updateCampaignSchema), campaigns_controller_1.campaignsController.update.bind(campaigns_controller_1.campaignsController));
/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign (cannot delete RUNNING campaigns)
 * @access  Private
 */
router.delete('/:id', (0, validate_1.validate)(campaigns_schema_1.deleteCampaignSchema), campaigns_controller_1.campaignsController.delete.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN ANALYTICS & CONTACTS
// ============================================
/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get detailed campaign analytics
 * @access  Private
 */
router.get('/:id/analytics', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAnalytics.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with delivery status
 * @access  Private
 */
router.get('/:id/contacts', (0, validate_1.validate)(campaigns_schema_1.getCampaignContactsSchema), campaigns_controller_1.campaignsController.getContacts.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN CONTROL ROUTES
// ============================================
/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign (validates token before starting)
 * @access  Private
 */
router.post('/:id/start', (0, validate_1.validate)(campaigns_schema_1.startCampaignSchema), campaigns_controller_1.campaignsController.start.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/pause
 * @desc    Pause running campaign
 * @access  Private
 */
router.post('/:id/pause', (0, validate_1.validate)(campaigns_schema_1.pauseCampaignSchema), campaigns_controller_1.campaignsController.pause.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/resume
 * @desc    Resume paused campaign (validates token)
 * @access  Private
 */
router.post('/:id/resume', (0, validate_1.validate)(campaigns_schema_1.resumeCampaignSchema), campaigns_controller_1.campaignsController.resume.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign (marks as FAILED)
 * @access  Private
 */
router.post('/:id/cancel', (0, validate_1.validate)(campaigns_schema_1.cancelCampaignSchema), campaigns_controller_1.campaignsController.cancel.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed/pending messages
 * @access  Private
 */
router.post('/:id/retry', (0, validate_1.validate)(campaigns_schema_1.retryCampaignSchema), campaigns_controller_1.campaignsController.retry.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign with new name
 * @access  Private
 */
router.post('/:id/duplicate', (0, validate_1.validate)(campaigns_schema_1.duplicateCampaignSchema), campaigns_controller_1.campaignsController.duplicate.bind(campaigns_controller_1.campaignsController));
// ============================================
// QUEUE MANAGEMENT (Optional - if using message queue)
// ============================================
/**
 * @route   GET /api/v1/campaigns/queue/stats
 * @desc    Get message queue statistics
 * @access  Private (Admin only recommended)
 */
router.get('/queue/stats', async (req, res, next) => {
    try {
        // Optional: Check if messageQueueWorker exists
        const messageQueueWorker = await Promise.resolve().then(() => __importStar(require('../../services/messageQueue.service'))).catch(() => null);
        if (!messageQueueWorker) {
            return (0, response_1.successResponse)(res, {
                data: {
                    enabled: false,
                    message: 'Message queue service not configured',
                },
                message: 'Queue not available',
            });
        }
        const stats = await messageQueueWorker.messageQueueWorker.getQueueStats();
        return (0, response_1.successResponse)(res, { data: stats, message: 'Queue statistics' });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/v1/campaigns/queue/retry/:campaignId?
 * @desc    Retry failed messages in queue (optional campaign filter)
 * @access  Private (Admin only recommended)
 */
router.post('/queue/retry/:campaignId?', async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        const messageQueueWorker = await Promise.resolve().then(() => __importStar(require('../../services/messageQueue.service'))).catch(() => null);
        if (!messageQueueWorker) {
            return res.status(404).json({
                success: false,
                message: 'Message queue service not configured',
            });
        }
        const count = await messageQueueWorker.messageQueueWorker.retryFailedMessages(campaignId);
        return (0, response_1.successResponse)(res, {
            data: {
                retriedCount: count,
                campaignId: campaignId || 'all',
            },
            message: `${count} failed messages queued for retry`,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/v1/campaigns/queue/clear
 * @desc    Clear failed messages from queue
 * @access  Private (Admin only)
 */
router.post('/queue/clear', async (req, res, next) => {
    try {
        const messageQueueWorker = await Promise.resolve().then(() => __importStar(require('../../services/messageQueue.service'))).catch(() => null);
        if (!messageQueueWorker) {
            return res.status(404).json({
                success: false,
                message: 'Message queue service not configured',
            });
        }
        // Clear failed messages
        const count = await messageQueueWorker.messageQueueWorker.clearFailedMessages();
        return (0, response_1.successResponse)(res, {
            data: {
                clearedCount: count,
            },
            message: `${count} failed messages cleared from queue`,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/v1/campaigns/queue/health
 * @desc    Check queue health status
 * @access  Private (Admin only)
 */
router.get('/queue/health', async (req, res, next) => {
    try {
        const messageQueueWorker = await Promise.resolve().then(() => __importStar(require('../../services/messageQueue.service'))).catch(() => null);
        if (!messageQueueWorker) {
            return res.json({
                success: true,
                data: {
                    enabled: false,
                    healthy: true,
                    message: 'Queue not configured (using direct sending)',
                },
            });
        }
        const health = await messageQueueWorker.messageQueueWorker.getHealthStatus();
        return (0, response_1.successResponse)(res, { data: health, message: 'Queue health status' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=campaigns.routes.js.map