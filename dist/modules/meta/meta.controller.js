"use strict";
// src/modules/meta/meta.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaController = void 0;
const meta_service_1 = require("./meta.service");
const response_1 = require("../../utils/response");
const uuid_1 = require("uuid");
// Helper function to safely get string from params/query
const getString = (value) => {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value) && typeof value[0] === 'string')
        return value[0];
    return '';
};
class MetaController {
    /**
     * Get Embedded Signup config
     */
    async getEmbeddedConfig(req, res, next) {
        try {
            const config = meta_service_1.metaService.getEmbeddedSignupConfig();
            return (0, response_1.successResponse)(res, {
                data: config,
                message: 'Embedded signup config retrieved',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Generate OAuth URL (alternative flow)
     */
    async getOAuthUrl(req, res, next) {
        try {
            const organizationId = getString(req.query.organizationId);
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization ID required', 400);
            }
            // Create state with org ID for callback
            const state = Buffer.from(JSON.stringify({
                organizationId,
                userId: req.user.id,
                nonce: (0, uuid_1.v4)(),
            })).toString('base64');
            const url = meta_service_1.metaService.getOAuthUrl(state);
            return (0, response_1.successResponse)(res, {
                data: { url, state },
                message: 'OAuth URL generated',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Handle OAuth callback / Complete connection
     */
    async handleCallback(req, res, next) {
        try {
            const { code, organizationId } = req.body;
            if (!code || !organizationId) {
                return (0, response_1.errorResponse)(res, 'Code and organization ID are required', 400);
            }
            // Verify user has access to organization
            const hasAccess = await this.verifyOrgAccess(req.user.id, String(organizationId));
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'You do not have access to this organization', 403);
            }
            const result = await meta_service_1.metaService.completeConnection(String(code), String(organizationId), req.user.id);
            if (!result.success) {
                return (0, response_1.errorResponse)(res, result.error || 'Connection failed', 400);
            }
            return (0, response_1.successResponse)(res, {
                data: { account: result.account },
                message: 'WhatsApp account connected successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get all WhatsApp accounts for organization
     */
    async getAccounts(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const accounts = await meta_service_1.metaService.getAccounts(organizationId);
            return (0, response_1.successResponse)(res, {
                data: { accounts },
                message: 'Accounts retrieved successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get single account
     */
    async getAccount(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const accountId = getString(req.params.accountId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await meta_service_1.metaService.getAccount(accountId, organizationId);
            return (0, response_1.successResponse)(res, {
                data: { account },
                message: 'Account retrieved successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Disconnect account
     */
    async disconnectAccount(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const accountId = getString(req.params.accountId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            await meta_service_1.metaService.disconnectAccount(accountId, organizationId);
            return (0, response_1.successResponse)(res, {
                message: 'Account disconnected successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Set default account
     */
    async setDefaultAccount(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const accountId = getString(req.params.accountId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            await meta_service_1.metaService.setDefaultAccount(accountId, organizationId);
            return (0, response_1.successResponse)(res, {
                message: 'Default account updated',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Refresh account health
     */
    async refreshHealth(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const accountId = getString(req.params.accountId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const health = await meta_service_1.metaService.refreshAccountHealth(accountId, organizationId);
            return (0, response_1.successResponse)(res, {
                data: health,
                message: 'Health check completed',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Sync templates
     */
    async syncTemplates(req, res, next) {
        try {
            const organizationId = getString(req.params.organizationId);
            const accountId = getString(req.params.accountId);
            const hasAccess = await this.verifyOrgAccess(req.user.id, organizationId);
            if (!hasAccess) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const result = await meta_service_1.metaService.syncTemplates(accountId, organizationId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Templates synced successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    async verifyOrgAccess(userId, organizationId) {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const member = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        return !!member;
    }
}
exports.metaController = new MetaController();
exports.default = exports.metaController;
//# sourceMappingURL=meta.controller.js.map