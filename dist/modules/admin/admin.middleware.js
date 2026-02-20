"use strict";
// src/modules/admin/admin.middleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireSuperAdmin = exports.authenticateAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
// ============================================
// AUTHENTICATE ADMIN MIDDLEWARE
// ============================================
const authenticateAdmin = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new errorHandler_1.AppError('Admin authentication required', 401);
        }
        if (!authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Invalid authorization format', 401);
        }
        const token = authHeader.substring(7);
        if (!token) {
            throw new errorHandler_1.AppError('Admin token required', 401);
        }
        // Verify token
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        }
        catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                throw new errorHandler_1.AppError('Admin token expired', 401);
            }
            if (jwtError.name === 'JsonWebTokenError') {
                throw new errorHandler_1.AppError('Invalid admin token', 401);
            }
            throw new errorHandler_1.AppError('Token verification failed', 401);
        }
        // Check if it's an admin token (has adminId, not userId)
        if (!decoded.adminId) {
            throw new errorHandler_1.AppError('Invalid admin token', 401);
        }
        // Get admin from database
        const admin = await database_1.default.adminUser.findUnique({
            where: { id: decoded.adminId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
            },
        });
        if (!admin) {
            throw new errorHandler_1.AppError('Admin not found', 401);
        }
        if (!admin.isActive) {
            throw new errorHandler_1.AppError('Admin account is inactive', 403);
        }
        // Attach admin to request
        req.admin = {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            name: admin.name,
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticateAdmin = authenticateAdmin;
// ============================================
// REQUIRE SUPER ADMIN MIDDLEWARE
// ============================================
const requireSuperAdmin = (req, res, next) => {
    if (!req.admin) {
        return next(new errorHandler_1.AppError('Admin authentication required', 401));
    }
    if (req.admin.role !== 'super_admin') {
        return next(new errorHandler_1.AppError('Super admin access required', 403));
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
// ============================================
// REQUIRE SPECIFIC ROLE MIDDLEWARE
// ============================================
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return next(new errorHandler_1.AppError('Admin authentication required', 401));
        }
        if (!roles.includes(req.admin.role)) {
            return next(new errorHandler_1.AppError(`Access denied. Required roles: ${roles.join(', ')}`, 403));
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=admin.middleware.js.map