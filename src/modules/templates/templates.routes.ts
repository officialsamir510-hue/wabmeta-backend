// src/modules/templates/templates.routes.ts

import { Router } from 'express';
import { templatesController } from './templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createTemplateSchema,
  updateTemplateSchema,
  getTemplatesSchema,
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
// TEMPLATE ROUTES
// ============================================

/**
 * @route   POST /api/v1/templates
 * @desc    Create new template
 * @access  Private
 */
router.post(
  '/',
  validate(createTemplateSchema),
  templatesController.create.bind(templatesController)
);

/**
 * @route   GET /api/v1/templates
 * @desc    Get templates list with pagination
 * @access  Private
 */
router.get(
  '/',
  validate(getTemplatesSchema),
  templatesController.getList.bind(templatesController)
);

/**
 * @route   GET /api/v1/templates/stats
 * @desc    Get template statistics
 * @access  Private
 */
router.get('/stats', templatesController.getStats.bind(templatesController));

/**
 * @route   GET /api/v1/templates/approved
 * @desc    Get only approved templates (for campaigns)
 * @access  Private
 */
router.get('/approved', templatesController.getApproved.bind(templatesController));

/**
 * @route   GET /api/v1/templates/languages
 * @desc    Get languages used in templates
 * @access  Private
 */
router.get('/languages', templatesController.getLanguages.bind(templatesController));

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
 * @access  Private
 */
router.post('/sync', templatesController.sync.bind(templatesController));

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