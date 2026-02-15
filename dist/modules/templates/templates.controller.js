"use strict";
// src/modules/templates/templates.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesController = void 0;
const templates_service_1 = require("./templates.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
class TemplatesController {
    // ==========================================
    // HELPER: Get default WhatsApp account
    // ==========================================
    async getDefaultAccountId(organizationId) {
        const defaultAccount = await database_1.default.whatsAppAccount.findFirst({
            where: {
                organizationId,
                status: 'CONNECTED',
                isDefault: true,
            },
            select: { id: true },
        });
        return defaultAccount?.id;
    }
    // ==========================================
    // CREATE TEMPLATE
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            // Validate template
            const validation = templates_service_1.templatesService.validateTemplate(input);
            if (!validation.valid) {
                throw new errorHandler_1.AppError(validation.errors.join(', '), 400);
            }
            // If no whatsappAccountId provided, use default
            if (!input.whatsappAccountId) {
                input.whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            const template = await templates_service_1.templatesService.create(organizationId, input);
            return (0, response_1.successResponse)(res, {
                data: template,
                message: 'Template created successfully',
                statusCode: 201,
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            // ✅ Parse query params safely
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit) : 20;
            const search = req.query.search?.trim() || undefined;
            const status = req.query.status;
            const category = req.query.category;
            const language = req.query.language?.trim() || undefined;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder || 'desc';
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            // ✅ If no whatsappAccountId, use default account
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            console.log('📋 Fetching templates:', {
                organizationId,
                page,
                limit,
                search,
                status,
                category,
                whatsappAccountId,
            });
            const result = await templates_service_1.templatesService.getList(organizationId, {
                page,
                limit,
                search,
                status,
                category,
                language,
                sortBy: sortBy,
                sortOrder,
                whatsappAccountId,
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            if (!id) {
                throw new errorHandler_1.AppError('Template ID is required', 400);
            }
            const template = await templates_service_1.templatesService.getById(organizationId, id);
            return (0, response_1.successResponse)(res, {
                data: template,
                message: 'Template fetched successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            if (!id) {
                throw new errorHandler_1.AppError('Template ID is required', 400);
            }
            const input = req.body;
            const template = await templates_service_1.templatesService.update(organizationId, id, input);
            return (0, response_1.successResponse)(res, {
                data: template,
                message: 'Template updated successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            if (!id) {
                throw new errorHandler_1.AppError('Template ID is required', 400);
            }
            const result = await templates_service_1.templatesService.delete(organizationId, id);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Template deleted successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            if (!id) {
                throw new errorHandler_1.AppError('Template ID is required', 400);
            }
            const { name, whatsappAccountId } = req.body;
            if (!name) {
                throw new errorHandler_1.AppError('New template name is required', 400);
            }
            const template = await templates_service_1.templatesService.duplicate(organizationId, id, name, whatsappAccountId);
            return (0, response_1.successResponse)(res, {
                data: template,
                message: 'Template duplicated successfully',
                statusCode: 201,
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            // ✅ If no whatsappAccountId, use default account
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            const stats = await templates_service_1.templatesService.getStats(organizationId, whatsappAccountId);
            return (0, response_1.successResponse)(res, {
                data: stats,
                message: 'Stats fetched successfully',
            });
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
            if (!bodyText) {
                throw new errorHandler_1.AppError('Body text is required', 400);
            }
            const preview = await templates_service_1.templatesService.preview(bodyText, variables || {}, headerType, headerContent, footerText, buttons);
            return (0, response_1.successResponse)(res, {
                data: preview,
                message: 'Preview generated successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            // ✅ If no whatsappAccountId, use default account
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            // ✅ If still no account, return empty array (not error)
            if (!whatsappAccountId) {
                return (0, response_1.successResponse)(res, {
                    data: [],
                    message: 'No WhatsApp account connected',
                });
            }
            const templates = await templates_service_1.templatesService.getApprovedTemplates(organizationId, whatsappAccountId);
            return (0, response_1.successResponse)(res, {
                data: templates,
                message: 'Approved templates fetched successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            // ✅ If no whatsappAccountId, use default account
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            const languages = await templates_service_1.templatesService.getLanguages(organizationId, whatsappAccountId);
            return (0, response_1.successResponse)(res, {
                data: languages,
                message: 'Languages fetched successfully',
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            if (!id) {
                throw new errorHandler_1.AppError('Template ID is required', 400);
            }
            const result = await templates_service_1.templatesService.submitToMeta(organizationId, id);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: result.message,
            });
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
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let whatsappAccountId = req.body?.whatsappAccountId?.trim() || undefined;
            // ✅ If no whatsappAccountId, use default account
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            // ✅ If still no account, return error
            if (!whatsappAccountId) {
                return (0, response_1.errorResponse)(res, 'No WhatsApp account connected. Please connect a WhatsApp account first.', 400);
            }
            console.log('🔄 Syncing templates for account:', whatsappAccountId);
            const result = await templates_service_1.templatesService.syncFromMeta(organizationId, whatsappAccountId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
// Export singleton instance
exports.templatesController = new TemplatesController();
exports.default = exports.templatesController;
//# sourceMappingURL=templates.controller.js.map