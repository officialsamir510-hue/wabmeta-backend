// src/modules/campaigns/campaigns.routes.ts

import { Router } from 'express';
import { campaignsController } from './campaigns.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createCampaignSchema,
  updateCampaignSchema,
  getCampaignsSchema,
  getCampaignByIdSchema,
  deleteCampaignSchema,
  getCampaignContactsSchema,
  startCampaignSchema,
  pauseCampaignSchema,
  resumeCampaignSchema,
  cancelCampaignSchema,
  retryCampaignSchema,
  duplicateCampaignSchema,
} from './campaigns.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CAMPAIGN ROUTES
// ============================================

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post(
  '/',
  validate(createCampaignSchema),
  campaignsController.create.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns list with pagination
 * @access  Private
 */
router.get(
  '/',
  validate(getCampaignsSchema),
  campaignsController.getList.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics
 * @access  Private
 */
router.get('/stats', campaignsController.getStats.bind(campaignsController));

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getCampaignByIdSchema),
  campaignsController.getById.bind(campaignsController)
);

/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateCampaignSchema),
  campaignsController.update.bind(campaignsController)
);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteCampaignSchema),
  campaignsController.delete.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get campaign analytics
 * @access  Private
 */
router.get(
  '/:id/analytics',
  validate(getCampaignByIdSchema),
  campaignsController.getAnalytics.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with status
 * @access  Private
 */
router.get(
  '/:id/contacts',
  validate(getCampaignContactsSchema),
  campaignsController.getContacts.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign
 * @access  Private
 */
router.post(
  '/:id/start',
  validate(startCampaignSchema),
  campaignsController.start.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/pause
 * @desc    Pause running campaign
 * @access  Private
 */
router.post(
  '/:id/pause',
  validate(pauseCampaignSchema),
  campaignsController.pause.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/resume
 * @desc    Resume paused campaign
 * @access  Private
 */
router.post(
  '/:id/resume',
  validate(resumeCampaignSchema),
  campaignsController.resume.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign
 * @access  Private
 */
router.post(
  '/:id/cancel',
  validate(cancelCampaignSchema),
  campaignsController.cancel.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed messages
 * @access  Private
 */
router.post(
  '/:id/retry',
  validate(retryCampaignSchema),
  campaignsController.retry.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  validate(duplicateCampaignSchema),
  campaignsController.duplicate.bind(campaignsController)
);

export default router;