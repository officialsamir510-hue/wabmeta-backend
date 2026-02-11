"use strict";
// src/middleware/auth.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireOrganization = exports.requireEmailVerified = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("./errorHandler");
const database_1 = __importDefault(require("../config/database"));
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Access token required', 401);
        }
        const token = authHeader.split(' ')[1];
        // Verify token
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        // Check if user exists
        const user = await database_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                status: true,
                emailVerified: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 401);
        }
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended', 403);
        }
        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            organizationId: decoded.organizationId,
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
const requireEmailVerified = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const user = await database_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { emailVerified: true },
        });
        if (!user?.emailVerified) {
            throw new errorHandler_1.AppError('Email verification required', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireEmailVerified = requireEmailVerified;
const requireOrganization = async (req, res, next) => {
    try {
        if (!req.user?.organizationId) {
            throw new errorHandler_1.AppError('Organization context required', 400);
        }
        const organization = await database_1.default.organization.findUnique({
            where: { id: req.user.organizationId },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        req.organization = organization;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireOrganization = requireOrganization;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = (0, jwt_1.verifyAccessToken)(token);
                const user = await database_1.default.user.findUnique({
                    where: { id: decoded.userId },
                    select: {
                        id: true,
                        email: true,
                        status: true,
                    },
                });
                if (user && user.status !== 'SUSPENDED') {
                    req.user = {
                        id: user.id,
                        email: user.email,
                        organizationId: decoded.organizationId,
                    };
                }
            }
            catch {
                // Token invalid, continue without user
            }
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map