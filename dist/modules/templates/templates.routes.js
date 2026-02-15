"use strict";
// src/modules/templates/templates.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templates_controller_1 = require("./templates.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const templates_schema_1 = require("./templates.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// LISTING ROUTES (No strict validation)
// ============================================
// GET /api/v1/templates
router.get('/', templates_controller_1.templatesController.getList.bind(templates_controller_1.templatesController));
// GET /api/v1/templates/stats
router.get('/stats', templates_controller_1.templatesController.getStats.bind(templates_controller_1.templatesController));
// GET /api/v1/templates/approved
router.get('/approved', templates_controller_1.templatesController.getApproved.bind(templates_controller_1.templatesController));
// GET /api/v1/templates/languages
router.get('/languages', templates_controller_1.templatesController.getLanguages.bind(templates_controller_1.templatesController));
// GET /api/v1/templates/check-connection
router.get('/check-connection', templates_controller_1.templatesController.checkConnection.bind(templates_controller_1.templatesController));
// ============================================
// ACTION ROUTES
// ============================================
// POST /api/v1/templates
router.post('/', (0, validate_1.validate)(templates_schema_1.createTemplateSchema), templates_controller_1.templatesController.create.bind(templates_controller_1.templatesController));
// POST /api/v1/templates/preview
router.post('/preview', (0, validate_1.validate)(templates_schema_1.previewTemplateSchema), templates_controller_1.templatesController.preview.bind(templates_controller_1.templatesController));
// POST /api/v1/templates/sync
router.post('/sync', templates_controller_1.templatesController.sync.bind(templates_controller_1.templatesController));
// ============================================
// SINGLE TEMPLATE ROUTES
// ============================================
// GET /api/v1/templates/:id
router.get('/:id', (0, validate_1.validate)(templates_schema_1.getTemplateByIdSchema), templates_controller_1.templatesController.getById.bind(templates_controller_1.templatesController));
// PUT /api/v1/templates/:id
router.put('/:id', (0, validate_1.validate)(templates_schema_1.updateTemplateSchema), templates_controller_1.templatesController.update.bind(templates_controller_1.templatesController));
// DELETE /api/v1/templates/:id
router.delete('/:id', (0, validate_1.validate)(templates_schema_1.deleteTemplateSchema), templates_controller_1.templatesController.delete.bind(templates_controller_1.templatesController));
// POST /api/v1/templates/:id/duplicate
router.post('/:id/duplicate', (0, validate_1.validate)(templates_schema_1.duplicateTemplateSchema), templates_controller_1.templatesController.duplicate.bind(templates_controller_1.templatesController));
// POST /api/v1/templates/:id/submit
router.post('/:id/submit', (0, validate_1.validate)(templates_schema_1.submitTemplateSchema), templates_controller_1.templatesController.submit.bind(templates_controller_1.templatesController));
exports.default = router;
//# sourceMappingURL=templates.routes.js.map