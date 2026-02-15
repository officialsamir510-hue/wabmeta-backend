// src/modules/templates/templates.routes.ts

import { Router } from 'express';
import { templatesController } from './templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createTemplateSchema,
  updateTemplateSchema,
  getTemplateByIdSchema,
  deleteTemplateSchema,
  duplicateTemplateSchema,
  submitTemplateSchema,
  previewTemplateSchema,
} from './templates.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// TEMPLATE LISTING ROUTES (No strict validation - handle in controller)
// ============================================

/**
 * @route   GET /api/v1/templates
 * @desc    Get templates list with pagination
 * @query   whatsappAccountId - Filter by specific WhatsApp account (optional)
 * @query   page, limit, search, status, category, language, sortBy, sortOrder
 * @access  Private
 */
router.get('/', templatesController.getList.bind(templatesController));

/**
 * @route   GET /api/v1/templates/stats
 * @desc    Get template statistics
 * @query   whatsappAccountId - Filter by specific WhatsApp account (optional)
 * @access  Private
 */
router.get('/stats', templatesController.getStats.bind(templatesController));

/**
 * @route   GET /api/v1/templates/approved
 * @desc    Get only approved templates (for campaigns)
 * @query   whatsappAccountId - Filter by specific WhatsApp account (optional)
 * @access  Private
 */
router.get('/approved', templatesController.getApproved.bind(templatesController));

/**
 * @route   GET /api/v1/templates/languages
 * @desc    Get languages used in templates
 * @query   whatsappAccountId - Filter by specific WhatsApp account (optional)
 * @access  Private
 */
router.get('/languages', templatesController.getLanguages.bind(templatesController));

// ============================================
// TEMPLATE ACTION ROUTES
// ============================================

/**
 * @route   POST /api/v1/templates
 * @desc    Create new template
 * @body    whatsappAccountId - Link to specific WhatsApp account (optional, uses default)
 * @access  Private
 */
router.post(
  '/',
  validate(createTemplateSchema),
  templatesController.create.bind(templatesController)
);

/**
 * @route   POST /api/v1/templates/preview
 * @desc    Preview template with variables
 * @access  Private
 */
router.post(
  '/preview',
  validate(previewTemplateSchema),
  templatesController.preview.bind(templatesController)
);

/**
 * @route   POST /api/v1/templates/sync
 * @desc    Sync templates from Meta
 * @body    whatsappAccountId - Sync from specific WhatsApp account (optional, uses default)
 * @access  Private
 */
router.post('/sync', templatesController.sync.bind(templatesController));

// ============================================
// SINGLE TEMPLATE ROUTES
// ============================================

/**
 * @route   GET /api/v1/templates/:id
 * @desc    Get template by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getTemplateByIdSchema),
  templatesController.getById.bind(templatesController)
);

/**
 * @route   PUT /api/v1/templates/:id
 * @desc    Update template
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateTemplateSchema),
  templatesController.update.bind(templatesController)
);

/**
 * @route   DELETE /api/v1/templates/:id
 * @desc    Delete template
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteTemplateSchema),
  templatesController.delete.bind(templatesController)
);

/**
 * @route   POST /api/v1/templates/:id/duplicate
 * @desc    Duplicate template
 * @body    name - Name for duplicated template (required)
 * @body    whatsappAccountId - Target WhatsApp account for duplicate (optional)
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  validate(duplicateTemplateSchema),
  templatesController.duplicate.bind(templatesController)
);

/**
 * @route   POST /api/v1/templates/:id/submit
 * @desc    Submit template to Meta for approval
 * @access  Private
 */
router.post(
  '/:id/submit',
  validate(submitTemplateSchema),
  templatesController.submit.bind(templatesController)
);

export default router;