// src/modules/templates/templates.routes.ts

import { Router } from 'express';
import { templatesController } from './templates.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
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
// LISTING ROUTES (No strict validation)
// ============================================

// GET /api/v1/templates
router.get('/', templatesController.getList.bind(templatesController));

// GET /api/v1/templates/stats
router.get('/stats', templatesController.getStats.bind(templatesController));

// GET /api/v1/templates/approved
router.get('/approved', templatesController.getApproved.bind(templatesController));

// GET /api/v1/templates/languages
router.get('/languages', templatesController.getLanguages.bind(templatesController));

// GET /api/v1/templates/check-connection
router.get('/check-connection', templatesController.checkConnection.bind(templatesController));

// ============================================
// ACTION ROUTES
// ============================================

// POST /api/v1/templates
router.post(
  '/',
  validate(createTemplateSchema),
  templatesController.create.bind(templatesController)
);

// POST /api/v1/templates/preview
router.post(
  '/preview',
  validate(previewTemplateSchema),
  templatesController.preview.bind(templatesController)
);

// POST /api/v1/templates/sync
router.post('/sync', templatesController.sync.bind(templatesController));

// ============================================
// SINGLE TEMPLATE ROUTES
// ============================================

// GET /api/v1/templates/:id
router.get(
  '/:id',
  validate(getTemplateByIdSchema),
  templatesController.getById.bind(templatesController)
);

// PUT /api/v1/templates/:id
router.put(
  '/:id',
  validate(updateTemplateSchema),
  templatesController.update.bind(templatesController)
);

// DELETE /api/v1/templates/:id
router.delete(
  '/:id',
  validate(deleteTemplateSchema),
  templatesController.delete.bind(templatesController)
);

// POST /api/v1/templates/:id/duplicate
router.post(
  '/:id/duplicate',
  validate(duplicateTemplateSchema),
  templatesController.duplicate.bind(templatesController)
);

// POST /api/v1/templates/:id/submit
router.post(
  '/:id/submit',
  validate(submitTemplateSchema),
  templatesController.submit.bind(templatesController)
);

export default router;