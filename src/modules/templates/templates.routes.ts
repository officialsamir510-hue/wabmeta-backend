// src/modules/templates/templates.routes.ts

import { Router } from 'express';
import { templatesController } from './templates.controller';
import { authenticate } from '../../middleware/auth';
import { uploadMiddleware, uploadTemplateMedia } from './templates.media';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ✅ CRITICAL: Media upload endpoint MUST be BEFORE /:id routes
router.post('/upload-media', uploadMiddleware.single('file'), uploadTemplateMedia);

// Template CRUD
router.post('/', templatesController.create);
router.get('/', templatesController.getList);
router.get('/stats', templatesController.getStats);
router.get('/approved', templatesController.getApproved);
router.get('/languages', templatesController.getLanguages);
router.post('/sync', templatesController.sync);
router.post('/preview', templatesController.preview);

// Specific template routes (AFTER /upload-media)
router.get('/:id', templatesController.getById);
router.put('/:id', templatesController.update);
router.delete('/:id', templatesController.delete);
router.post('/:id/submit', templatesController.submit);
router.post('/:id/duplicate', templatesController.duplicate);

export default router;