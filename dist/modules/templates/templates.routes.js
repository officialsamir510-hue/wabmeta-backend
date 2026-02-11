"use strict";
// src/modules/templates/templates.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templates_controller_1 = require("./templates.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const templates_schema_1 = require("./templates.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// TEMPLATE ROUTES
// ============================================
/**
 * @route   POST /api/v1/templates
 * @desc    Create new template
 * @access  Private
 */
router.post('/', (0, validate_1.validate)(templates_schema_1.createTemplateSchema), templates_controller_1.templatesController.create.bind(templates_controller_1.templatesController));
/**
 * @route   GET /api/v1/templates
 * @desc    Get templates list with pagination
 * @access  Private
 */
router.get('/', (0, validate_1.validate)(templates_schema_1.getTemplatesSchema), templates_controller_1.templatesController.getList.bind(templates_controller_1.templatesController));
/**
 * @route   GET /api/v1/templates/stats
 * @desc    Get template statistics
 * @access  Private
 */
router.get('/stats', templates_controller_1.templatesController.getStats.bind(templates_controller_1.templatesController));
/**
 * @route   GET /api/v1/templates/approved
 * @desc    Get only approved templates (for campaigns)
 * @access  Private
 */
router.get('/approved', templates_controller_1.templatesController.getApproved.bind(templates_controller_1.templatesController));
/**
 * @route   GET /api/v1/templates/languages
 * @desc    Get languages used in templates
 * @access  Private
 */
router.get('/languages', templates_controller_1.templatesController.getLanguages.bind(templates_controller_1.templatesController));
/**
 * @route   POST /api/v1/templates/preview
 * @desc    Preview template with variables
 * @access  Private
 */
router.post('/preview', (0, validate_1.validate)(templates_schema_1.previewTemplateSchema), templates_controller_1.templatesController.preview.bind(templates_controller_1.templatesController));
/**
 * @route   POST /api/v1/templates/sync
 * @desc    Sync templates from Meta
 * @access  Private
 */
router.post('/sync', templates_controller_1.templatesController.sync.bind(templates_controller_1.templatesController));
/**
 * @route   GET /api/v1/templates/:id
 * @desc    Get template by ID
 * @access  Private
 */
router.get('/:id', (0, validate_1.validate)(templates_schema_1.getTemplateByIdSchema), templates_controller_1.templatesController.getById.bind(templates_controller_1.templatesController));
/**
 * @route   PUT /api/v1/templates/:id
 * @desc    Update template
 * @access  Private
 */
router.put('/:id', (0, validate_1.validate)(templates_schema_1.updateTemplateSchema), templates_controller_1.templatesController.update.bind(templates_controller_1.templatesController));
/**
 * @route   DELETE /api/v1/templates/:id
 * @desc    Delete template
 * @access  Private
 */
router.delete('/:id', (0, validate_1.validate)(templates_schema_1.deleteTemplateSchema), templates_controller_1.templatesController.delete.bind(templates_controller_1.templatesController));
/**
 * @route   POST /api/v1/templates/:id/duplicate
 * @desc    Duplicate template
 * @access  Private
 */
router.post('/:id/duplicate', (0, validate_1.validate)(templates_schema_1.duplicateTemplateSchema), templates_controller_1.templatesController.duplicate.bind(templates_controller_1.templatesController));
/**
 * @route   POST /api/v1/templates/:id/submit
 * @desc    Submit template to Meta for approval
 * @access  Private
 */
router.post('/:id/submit', (0, validate_1.validate)(templates_schema_1.submitTemplateSchema), templates_controller_1.templatesController.submit.bind(templates_controller_1.templatesController));
exports.default = router;
//# sourceMappingURL=templates.routes.js.map