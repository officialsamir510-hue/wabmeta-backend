"use strict";
// 📁 src/modules/meta/meta.controller.ts - COMPLETE FIXED VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaController = exports.MetaController = void 0;
const meta_service_1 = require("./meta.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const otp_1 = require("../../utils/otp");
// Helper to safely get organization ID from headers
const getOrgId = (req) => {
    const header = req.headers['x-organization-id'];
    if (!header)
        return '';
    return Array.isArray(header) ? header[0] : header;
};
class MetaController {
    // ============================================
    // GET OAUTH URL
    // ============================================
    async getOAuthUrl(req, res, next) {
        try {
            const { organizationId } = req.query;
            if (!organizationId || typeof organizationId !== 'string') {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to connect WhatsApp', 403);
            }
            const stateToken = (0, otp_1.generateToken)();
            const state = `${organizationId}:${stateToken}`;
            await database_1.default.oAuthState.create({
                data: {
                    state,
                    organizationId,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                },
            });
            await database_1.default.oAuthState.deleteMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });
            const url = meta_service_1.metaService.getOAuthUrl(state);
            console.log('📱 OAuth URL generated for organization:', organizationId);
            return (0, response_1.sendSuccess)(res, { url, state }, 'OAuth URL generated');
        }
        catch (error) {
            next(error);
        }
    }
    async getAuthUrl(req, res, next) {
        return this.getOAuthUrl(req, res, next);
    }
    // ============================================
    // HANDLE CALLBACK
    // ============================================
    async handleCallback(req, res, next) {
        try {
            const { code, state } = req.body;
            console.log('\n🔄 ========== META CALLBACK ==========');
            console.log('   Code received:', code ? 'Yes' : 'No');
            console.log('   State received:', state ? 'Yes' : 'No');
            if (!code) {
                throw new errorHandler_1.AppError('Authorization code is required', 400);
            }
            let organizationId;
            if (state) {
                const storedState = await database_1.default.oAuthState.findUnique({
                    where: { state },
                });
                if (!storedState) {
                    throw new errorHandler_1.AppError('Invalid or expired state token', 400);
                }
                if (storedState.expiresAt < new Date()) {
                    await database_1.default.oAuthState.delete({ where: { state } });
                    throw new errorHandler_1.AppError('State token expired. Please try again.', 400);
                }
                organizationId = storedState.organizationId;
                await database_1.default.oAuthState.delete({ where: { state } });
            }
            else if (req.body.organizationId) {
                organizationId = req.body.organizationId;
            }
            else {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            console.log('   Organization ID:', organizationId);
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to connect WhatsApp', 403);
            }
            const result = await meta_service_1.metaService.completeConnection(code, organizationId, userId, (progress) => {
                console.log(`📊 ${progress.step}: ${progress.message}`);
            });
            if (!result.success) {
                throw new errorHandler_1.AppError(result.error || 'Failed to connect WhatsApp account', 500);
            }
            console.log('✅ Meta callback successful');
            console.log('🔄 ========== META CALLBACK END ==========\n');
            return (0, response_1.sendSuccess)(res, { account: result.account }, 'WhatsApp account connected successfully');
        }
        catch (error) {
            console.error('❌ Meta callback error:', error);
            next(error);
        }
    }
    // ============================================
    // CONNECT
    // ============================================
    async connect(req, res, next) {
        try {
            const { code, accessToken, organizationId } = req.body;
            const codeOrToken = accessToken || code;
            if (!codeOrToken) {
                throw new errorHandler_1.AppError('Authorization code or access token is required', 400);
            }
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to connect WhatsApp', 403);
            }
            const result = await meta_service_1.metaService.completeConnection(codeOrToken, organizationId, userId, (progress) => {
                console.log(`📊 ${progress.step}: ${progress.message}`);
            });
            if (!result.success) {
                throw new errorHandler_1.AppError(result.error || 'Failed to connect WhatsApp account', 500);
            }
            return (0, response_1.sendSuccess)(res, { account: result.account }, 'WhatsApp account connected successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET ACCOUNTS
    // ============================================
    async getAccounts(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const accounts = await meta_service_1.metaService.getAccounts(organizationId);
            return (0, response_1.sendSuccess)(res, accounts, 'Accounts fetched');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET ACCOUNT
    // ============================================
    async getAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const account = await meta_service_1.metaService.getAccount(id, organizationId);
            return (0, response_1.sendSuccess)(res, account, 'Account fetched');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // DISCONNECT ACCOUNT
    // ============================================
    async disconnectAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to disconnect', 403);
            }
            const result = await meta_service_1.metaService.disconnectAccount(id, organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Account disconnected');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // SET DEFAULT ACCOUNT
    // ============================================
    async setDefaultAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await meta_service_1.metaService.setDefaultAccount(id, organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Default account updated');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // SYNC TEMPLATES
    // ============================================
    async syncTemplates(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await meta_service_1.metaService.syncTemplates(id, organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Templates synced');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET ORGANIZATION STATUS
    // ============================================
    async getOrganizationStatus(req, res, next) {
        try {
            const organizationId = Array.isArray(req.params.organizationId) ? req.params.organizationId[0] : req.params.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
            });
            const status = accounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';
            return (0, response_1.sendSuccess)(res, {
                status,
                connectedCount: accounts.length,
                accounts: accounts.map((a) => ({
                    id: a.id,
                    phoneNumber: a.phoneNumber,
                    displayName: a.displayName,
                    isDefault: a.isDefault,
                })),
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET CONFIG
    // ============================================
    async getEmbeddedSignupConfig(req, res, next) {
        try {
            const config = meta_service_1.metaService.getEmbeddedSignupConfig();
            return (0, response_1.sendSuccess)(res, config, 'Config fetched');
        }
        catch (error) {
            next(error);
        }
    }
    async getIntegrationStatus(req, res, next) {
        try {
            const status = meta_service_1.metaService.getIntegrationStatus();
            return (0, response_1.sendSuccess)(res, status, 'Integration status');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MetaController = MetaController;
exports.metaController = new MetaController();
exports.default = exports.metaController;
//# sourceMappingURL=meta.controller.js.map