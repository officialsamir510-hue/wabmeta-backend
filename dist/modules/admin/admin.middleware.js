"use strict";
// src/modules/admin/admin.middleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAdminToken = exports.requireSuperAdmin = exports.authenticateAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
// Authenticate admin
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Admin access token required', 401);
        }
        const token = authHeader.split(' ')[1];
        // Verify token using config.jwt.secret
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        if (decoded.type !== 'admin') {
            throw new errorHandler_1.AppError('Invalid admin token', 401);
        }
        // Check if admin exists
        const admin = await database_1.default.adminUser.findUnique({
            where: { id: decoded.adminId },
            select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
            },
        });
        if (!admin) {
            throw new errorHandler_1.AppError('Admin not found', 401);
        }
        if (!admin.isActive) {
            throw new errorHandler_1.AppError('Admin account is disabled', 403);
        }
        // Attach admin to request
        req.admin = {
            id: admin.id,
            email: admin.email,
            role: admin.role,
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.AppError('Invalid admin token', 401));
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new errorHandler_1.AppError('Admin token expired', 401));
        }
        else {
            next(error);
        }
    }
};
exports.authenticateAdmin = authenticateAdmin;
// Require super admin role
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.admin) {
            throw new errorHandler_1.AppError('Admin authentication required', 401);
        }
        if (req.admin.role !== 'super_admin') {
            throw new errorHandler_1.AppError('Super admin access required', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
// Generate admin token
const generateAdminToken = (admin) => {
    return jsonwebtoken_1.default.sign({
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin',
    }, config_1.config.jwt.secret, { expiresIn: '24h' });
};
exports.generateAdminToken = generateAdminToken;
//# sourceMappingURL=admin.middleware.js.map