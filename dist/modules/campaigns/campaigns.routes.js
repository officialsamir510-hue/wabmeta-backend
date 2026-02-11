"use strict";
// src/modules/campaigns/campaigns.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaigns_controller_1 = require("./campaigns.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const campaigns_schema_1 = require("./campaigns.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// CAMPAIGN ROUTES
// ============================================
/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post('/', (0, validate_1.validate)(campaigns_schema_1.createCampaignSchema), campaigns_controller_1.campaignsController.create.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns list with pagination
 * @access  Private
 */
router.get('/', (0, validate_1.validate)(campaigns_schema_1.getCampaignsSchema), campaigns_controller_1.campaignsController.getList.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics
 * @access  Private
 */
router.get('/stats', campaigns_controller_1.campaignsController.getStats.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get('/:id', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getById.bind(campaigns_controller_1.campaignsController));
/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign
 * @access  Private
 */
router.put('/:id', (0, validate_1.validate)(campaigns_schema_1.updateCampaignSchema), campaigns_controller_1.campaignsController.update.bind(campaigns_controller_1.campaignsController));
/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign
 * @access  Private
 */
router.delete('/:id', (0, validate_1.validate)(campaigns_schema_1.deleteCampaignSchema), campaigns_controller_1.campaignsController.delete.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get campaign analytics
 * @access  Private
 */
router.get('/:id/analytics', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAnalytics.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with status
 * @access  Private
 */
router.get('/:id/contacts', (0, validate_1.validate)(campaigns_schema_1.getCampaignContactsSchema), campaigns_controller_1.campaignsController.getContacts.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign
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
 * @desc    Resume paused campaign
 * @access  Private
 */
router.post('/:id/resume', (0, validate_1.validate)(campaigns_schema_1.resumeCampaignSchema), campaigns_controller_1.campaignsController.resume.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign
 * @access  Private
 */
router.post('/:id/cancel', (0, validate_1.validate)(campaigns_schema_1.cancelCampaignSchema), campaigns_controller_1.campaignsController.cancel.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed messages
 * @access  Private
 */
router.post('/:id/retry', (0, validate_1.validate)(campaigns_schema_1.retryCampaignSchema), campaigns_controller_1.campaignsController.retry.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign
 * @access  Private
 */
router.post('/:id/duplicate', (0, validate_1.validate)(campaigns_schema_1.duplicateCampaignSchema), campaigns_controller_1.campaignsController.duplicate.bind(campaigns_controller_1.campaignsController));
exports.default = router;
//# sourceMappingURL=campaigns.routes.js.map