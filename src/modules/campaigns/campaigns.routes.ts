// 📁 src/modules/campaigns/campaigns.routes.ts - COMPLETE WITH CSV UPLOAD

import { Router } from 'express';
import { campaignsController, csvUpload } from './campaigns.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { successResponse } from '../../utils/response';
import { checkCampaignLimit } from '../../middleware/planLimits';
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

// ============================================
// MIDDLEWARE
// ============================================

// All routes require authentication
router.use(authenticate);

// ============================================
// STATISTICS & ANALYTICS (Must be before :id routes)
// ============================================

/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics for organization
 * @access  Private
 */
router.get('/stats', campaignsController.getStats.bind(campaignsController));

// ============================================
// CSV UPLOAD ROUTES (Must be before :id routes)
// ============================================

/**
 * @route   POST /api/v1/campaigns/upload-contacts
 * @desc    Upload CSV and create contacts
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post(
  '/upload-contacts',
  csvUpload,
  campaignsController.uploadContacts.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/upload-template
 * @desc    Get CSV upload template format
 * @access  Private
 */
router.get(
  '/upload-template',
  campaignsController.getUploadTemplate.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/upload-validate
 * @desc    Validate CSV file without importing
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post(
  '/upload-validate',
  csvUpload,
  campaignsController.validateCsvFile.bind(campaignsController)
);

// ============================================
// CAMPAIGN CRUD ROUTES
// ============================================

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post(
  '/',
  checkCampaignLimit,
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
 * @desc    Update campaign (only DRAFT or SCHEDULED)
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateCampaignSchema),
  campaignsController.update.bind(campaignsController)
);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign (cannot delete RUNNING campaigns)
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteCampaignSchema),
  campaignsController.delete.bind(campaignsController)
);

// ============================================
// CAMPAIGN ANALYTICS & CONTACTS
// ============================================

/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get detailed campaign analytics
 * @access  Private
 */
router.get(
  '/:id/analytics',
  validate(getCampaignByIdSchema),
  campaignsController.getAnalytics.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with delivery status
 * @access  Private
 */
router.get(
  '/:id/contacts',
  validate(getCampaignContactsSchema),
  campaignsController.getContacts.bind(campaignsController)
);

// ============================================
// CAMPAIGN CONTROL ROUTES
// ============================================

/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign (validates token before starting)
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
 * @desc    Resume paused campaign (validates token)
 * @access  Private
 */
router.post(
  '/:id/resume',
  validate(resumeCampaignSchema),
  campaignsController.resume.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign (marks as FAILED)
 * @access  Private
 */
router.post(
  '/:id/cancel',
  validate(cancelCampaignSchema),
  campaignsController.cancel.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed/pending messages
 * @access  Private
 */
router.post(
  '/:id/retry',
  validate(retryCampaignSchema),
  campaignsController.retry.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign with new name
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  validate(duplicateCampaignSchema),
  campaignsController.duplicate.bind(campaignsController)
);

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
    const messageQueueWorker = await import('../../services/messageQueue.service').catch(() => null);

    if (!messageQueueWorker) {
      return successResponse(res, {
        data: {
          enabled: false,
          message: 'Message queue service not configured',
        },
        message: 'Queue not available',
      });
    }

    const stats = await messageQueueWorker.messageQueueWorker.getQueueStats();
    return successResponse(res, { data: stats, message: 'Queue statistics' });
  } catch (error) {
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
    const { campaignId } = req.params as any;

    const messageQueueWorker = await import('../../services/messageQueue.service').catch(() => null);

    if (!messageQueueWorker) {
      return res.status(404).json({
        success: false,
        message: 'Message queue service not configured',
      });
    }

    const count = await messageQueueWorker.messageQueueWorker.retryFailedMessages(campaignId);

    return successResponse(res, {
      data: {
        retriedCount: count,
        campaignId: campaignId || 'all',
      },
      message: `${count} failed messages queued for retry`,
    });
  } catch (error) {
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
    const messageQueueWorker = await import('../../services/messageQueue.service').catch(() => null);

    if (!messageQueueWorker) {
      return res.status(404).json({
        success: false,
        message: 'Message queue service not configured',
      });
    }

    // Clear failed messages
    const count = await messageQueueWorker.messageQueueWorker.clearFailedMessages();

    return successResponse(res, {
      data: {
        clearedCount: count,
      },
      message: `${count} failed messages cleared from queue`,
    });
  } catch (error) {
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
    const messageQueueWorker = await import('../../services/messageQueue.service').catch(() => null);

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

    return successResponse(res, { data: health, message: 'Queue health status' });
  } catch (error) {
    next(error);
  }
});

export default router;