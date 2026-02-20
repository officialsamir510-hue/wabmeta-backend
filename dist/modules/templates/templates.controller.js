"use strict";
// src/modules/templates/templates.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesController = void 0;
const templates_service_1 = require("./templates.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const meta_service_1 = require("../meta/meta.service");
class TemplatesController {
    // ==========================================
    // HELPER: Get default WhatsApp account
    // ==========================================
    async getDefaultAccountId(organizationId) {
        // First try default account
        let account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                organizationId,
                status: 'CONNECTED',
                isDefault: true,
            },
            select: { id: true },
        });
        // If no default, get any connected account
        if (!account) {
            account = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
        }
        return account?.id;
    }
    // ✅ NEW HELPER: Get wabaId for an account
    async getWabaIdForAccount(accountId) {
        const account = await database_1.default.whatsAppAccount.findUnique({
            where: { id: accountId },
            select: { wabaId: true },
        });
        return account?.wabaId || undefined;
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
            console.log('📝 Creating template:', {
                organizationId,
                name: input.name,
                language: input.language,
                whatsappAccountId: input.whatsappAccountId,
            });
            // If no whatsappAccountId provided, use default
            if (!input.whatsappAccountId) {
                input.whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            const template = await templates_service_1.templatesService.create(organizationId, input);
            return res.status(201).json({
                success: true,
                message: 'Template created successfully',
                data: template,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET TEMPLATES LIST
    // ✅ FIX: Added wabaId query param support
    // ==========================================
    async getList(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            // Parse query params safely
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit) : 20;
            const search = req.query.search?.trim() || undefined;
            const status = req.query.status;
            const category = req.query.category;
            const language = req.query.language?.trim() || undefined;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder || 'desc';
            const whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const wabaId = req.query.wabaId?.trim() || undefined; // ✅ NEW
            console.log('📋 Fetching templates:', {
                organizationId,
                page,
                limit,
                search,
                status,
                whatsappAccountId,
                wabaId, // ✅ log it
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
                wabaId, // ✅ pass to service
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
            return res.json({
                success: true,
                message: 'Template fetched successfully',
                data: template,
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
            return res.json({
                success: true,
                message: 'Template updated successfully',
                data: template,
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
            return res.json({
                success: true,
                message: result.message,
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
            return res.status(201).json({
                success: true,
                message: 'Template duplicated successfully',
                data: template,
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
            const whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const stats = await templates_service_1.templatesService.getStats(organizationId, whatsappAccountId);
            return res.json({
                success: true,
                message: 'Stats fetched successfully',
                data: stats,
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
            return res.json({
                success: true,
                message: 'Preview generated successfully',
                data: preview,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET APPROVED TEMPLATES
    // ✅ FIX: Added wabaId support
    // ==========================================
    async getApproved(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            let wabaId = req.query.wabaId?.trim() || undefined; // ✅ NEW
            // If no account specified, use default
            if (!whatsappAccountId && !wabaId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            // ✅ If whatsappAccountId provided but no wabaId, resolve wabaId
            if (whatsappAccountId && !wabaId) {
                wabaId = await this.getWabaIdForAccount(whatsappAccountId);
            }
            // If still no account, return empty array
            if (!whatsappAccountId && !wabaId) {
                return res.json({
                    success: true,
                    message: 'No WhatsApp account connected',
                    data: [],
                });
            }
            const templates = await templates_service_1.templatesService.getApprovedTemplates(organizationId, whatsappAccountId, wabaId // ✅ pass wabaId
            );
            return res.json({
                success: true,
                message: 'Approved templates fetched successfully',
                data: templates,
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
            const whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const languages = await templates_service_1.templatesService.getLanguages(organizationId, whatsappAccountId);
            return res.json({
                success: true,
                message: 'Languages fetched successfully',
                data: languages,
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
            const { whatsappAccountId } = req.body;
            const result = await templates_service_1.templatesService.submitToMeta(organizationId, id, whatsappAccountId);
            return res.json({
                success: true,
                message: result.message,
                data: result,
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
            // If no account specified, use default
            if (!whatsappAccountId) {
                whatsappAccountId = await this.getDefaultAccountId(organizationId);
            }
            // If still no account, return error
            if (!whatsappAccountId) {
                return res.status(400).json({
                    success: false,
                    message: 'No WhatsApp account connected. Please connect a WhatsApp account first.',
                });
            }
            console.log('🔄 Syncing templates for account:', whatsappAccountId);
            const result = await templates_service_1.templatesService.syncFromMeta(organizationId, whatsappAccountId);
            return res.json({
                success: true,
                message: result.message,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // CHECK WHATSAPP CONNECTION
    // ==========================================
    async checkConnection(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            // Check for any WhatsApp accounts
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    phoneNumber: true,
                    displayName: true,
                    status: true,
                    isDefault: true,
                    wabaId: true,
                    createdAt: true,
                    tokenExpiresAt: true,
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'desc' },
                ],
            });
            if (accounts.length === 0) {
                return res.json({
                    success: false,
                    message: 'No WhatsApp accounts found',
                    hasConnection: false,
                    accounts: [],
                    connectedCount: 0,
                    totalCount: 0,
                });
            }
            // Check which accounts are truly connected
            const accountsWithStatus = await Promise.all(accounts.map(async (account) => {
                let canDecrypt = false;
                let isExpired = false;
                try {
                    const result = await meta_service_1.metaService.getAccountWithToken(account.id);
                    canDecrypt = !!result;
                }
                catch (err) {
                    // Silent fail
                }
                if (account.tokenExpiresAt) {
                    isExpired = account.tokenExpiresAt < new Date();
                }
                return {
                    ...account,
                    canDecrypt,
                    isExpired,
                    isReady: account.status === 'CONNECTED' && canDecrypt && !isExpired,
                };
            }));
            const connectedAccounts = accountsWithStatus.filter(a => a.isReady);
            const defaultAccount = accountsWithStatus.find(a => a.isDefault);
            return res.json({
                success: true,
                hasConnection: connectedAccounts.length > 0,
                defaultAccount: defaultAccount || connectedAccounts[0] || null,
                accounts: accountsWithStatus,
                connectedCount: connectedAccounts.length,
                totalCount: accounts.length,
            });
        }
        catch (error) {
            console.error('❌ Error checking connection:', error.message);
            next(error);
        }
    }
}
exports.templatesController = new TemplatesController();
exports.default = exports.templatesController;
//# sourceMappingURL=templates.controller.js.map