"use strict";
// src/modules/templates/templates.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesController = exports.TemplatesController = void 0;
const templates_service_1 = require("./templates.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class TemplatesController {
    // ==========================================
    // CREATE TEMPLATE
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            // Validate template
            const validation = templates_service_1.templatesService.validateTemplate(input);
            if (!validation.valid) {
                throw new errorHandler_1.AppError(validation.errors.join(', '), 400);
            }
            const template = await templates_service_1.templatesService.create(organizationId, input);
            return (0, response_1.sendSuccess)(res, template, 'Template created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET TEMPLATES LIST
    // ==========================================
    async getList(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                status: req.query.status,
                category: req.query.category,
                language: req.query.language,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await templates_service_1.templatesService.getList(organizationId, query);
            return res.json({
                success: true,
                message: 'Templates fetched successfully',
                data: result.templates,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET TEMPLATE BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const template = await templates_service_1.templatesService.getById(organizationId, id);
            return (0, response_1.sendSuccess)(res, template, 'Template fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE TEMPLATE
    // ==========================================
    async update(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const input = req.body;
            const template = await templates_service_1.templatesService.update(organizationId, id, input);
            return (0, response_1.sendSuccess)(res, template, 'Template updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE TEMPLATE
    // ==========================================
    async delete(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const result = await templates_service_1.templatesService.delete(organizationId, id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DUPLICATE TEMPLATE
    // ==========================================
    async duplicate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const { name } = req.body;
            const template = await templates_service_1.templatesService.duplicate(organizationId, id, name);
            return (0, response_1.sendSuccess)(res, template, 'Template duplicated successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET TEMPLATE STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await templates_service_1.templatesService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // PREVIEW TEMPLATE
    // ==========================================
    async preview(req, res, next) {
        try {
            const { bodyText, variables, headerType, headerContent, footerText, buttons } = req.body;
            const preview = await templates_service_1.templatesService.preview(bodyText, variables || {}, headerType, headerContent, footerText, buttons);
            return (0, response_1.sendSuccess)(res, preview, 'Preview generated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET APPROVED TEMPLATES
    // ==========================================
    async getApproved(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const templates = await templates_service_1.templatesService.getApprovedTemplates(organizationId);
            return (0, response_1.sendSuccess)(res, templates, 'Approved templates fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET LANGUAGES
    // ==========================================
    async getLanguages(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const languages = await templates_service_1.templatesService.getLanguages(organizationId);
            return (0, response_1.sendSuccess)(res, languages, 'Languages fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SUBMIT TO META
    // ==========================================
    async submit(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const { whatsappAccountId } = req.body;
            const result = await templates_service_1.templatesService.submitToMeta(organizationId, id, whatsappAccountId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SYNC FROM META
    // ==========================================
    async sync(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { whatsappAccountId } = req.body;
            const result = await templates_service_1.templatesService.syncFromMeta(organizationId, whatsappAccountId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TemplatesController = TemplatesController;
// Export singleton instance
exports.templatesController = new TemplatesController();
//# sourceMappingURL=templates.controller.js.map