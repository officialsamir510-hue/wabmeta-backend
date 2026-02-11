"use strict";
// src/middleware/errorHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const config_1 = require("../config");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// ✅ Safe logger (prevents crash from logging)
const logErrorSafe = (err, req) => {
    try {
        const timestamp = new Date().toISOString();
        const method = req?.method || 'UNKNOWN';
        const url = req?.url || 'UNKNOWN';
        console.error(`❌ [${timestamp}] ${method} ${url}`);
        if (err instanceof Error) {
            console.error(`   Error: ${err.message}`);
            if (config_1.config.nodeEnv === 'development' && err.stack) {
                console.error(`   Stack: ${err.stack}`);
            }
            return;
        }
        // Fallback for non-Error objects
        console.error('   Error:', typeof err === 'string' ? err : JSON.stringify(err));
    }
    catch {
        console.error('Unknown error (failed to log safely)');
    }
};
// ✅ Send JSON error response
const sendJsonError = (res, message, statusCode = 500, errors) => {
    // Prevent double response
    if (res.headersSent) {
        return;
    }
    const response = {
        success: false,
        error: message,
        message: message,
        statusCode,
    };
    if (errors && errors.length > 0) {
        response.errors = errors;
    }
    res.status(statusCode).json(response);
};
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    // Log the error
    logErrorSafe(err, req);
    // Prevent double response
    if (res.headersSent) {
        return next(err);
    }
    // ============================================
    // ZOD VALIDATION ERRORS
    // ============================================
    if (err instanceof zod_1.ZodError) {
        const errors = err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return sendJsonError(res, 'Validation failed', 400, errors);
    }
    // ============================================
    // PRISMA ERRORS
    // ============================================
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': {
                // Unique constraint violation
                const field = err.meta?.target?.[0] || 'field';
                return sendJsonError(res, `This ${field} already exists`, 409);
            }
            case 'P2003': {
                // Foreign key constraint
                return sendJsonError(res, 'Related record not found', 400);
            }
            case 'P2025': {
                // Record not found
                return sendJsonError(res, 'Record not found', 404);
            }
            case 'P2024': {
                // Connection pool timeout
                console.error('⚠️ Database connection pool timeout');
                return sendJsonError(res, 'Database temporarily unavailable. Please try again.', 503);
            }
            default:
                return sendJsonError(res, 'Database error', 500, [
                    { field: 'prisma', message: `Error code: ${err.code}` }
                ]);
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientInitializationError) {
        console.error('⚠️ Database connection failed');
        return sendJsonError(res, 'Database connection failed', 503);
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        return sendJsonError(res, 'Invalid data provided', 400);
    }
    // ============================================
    // CUSTOM APP ERRORS
    // ============================================
    if (err instanceof AppError) {
        return sendJsonError(res, err.message, err.statusCode);
    }
    // ============================================
    // JWT ERRORS
    // ============================================
    if (typeof err === 'object' && err !== null && 'name' in err) {
        const name = err.name;
        if (name === 'JsonWebTokenError') {
            return sendJsonError(res, 'Invalid token', 401);
        }
        if (name === 'TokenExpiredError') {
            return sendJsonError(res, 'Token expired', 401);
        }
        if (name === 'NotBeforeError') {
            return sendJsonError(res, 'Token not yet valid', 401);
        }
    }
    // ============================================
    // MULTER ERRORS (File Upload)
    // ============================================
    if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = err.code;
        if (code === 'LIMIT_FILE_SIZE') {
            return sendJsonError(res, 'File too large', 400);
        }
        if (code === 'LIMIT_FILE_COUNT') {
            return sendJsonError(res, 'Too many files', 400);
        }
        if (code === 'LIMIT_UNEXPECTED_FILE') {
            return sendJsonError(res, 'Unexpected file field', 400);
        }
    }
    // ============================================
    // AXIOS/FETCH ERRORS (External API)
    // ============================================
    if (typeof err === 'object' && err !== null && 'isAxiosError' in err) {
        const axiosError = err;
        const status = axiosError.response?.status || 500;
        const message = axiosError.response?.data?.error?.message ||
            axiosError.response?.data?.message ||
            axiosError.message ||
            'External API error';
        console.error('⚠️ External API error:', {
            status,
            url: axiosError.config?.url,
            message,
        });
        return sendJsonError(res, message, status >= 500 ? 502 : status);
    }
    // ============================================
    // SYNTAX ERRORS (JSON Parse)
    // ============================================
    if (err instanceof SyntaxError && 'body' in err) {
        return sendJsonError(res, 'Invalid JSON in request body', 400);
    }
    // ============================================
    // DEFAULT ERROR
    // ============================================
    let message = 'Internal server error';
    let statusCode = 500;
    if (err instanceof Error) {
        // In development, show actual error message
        if (config_1.config.nodeEnv === 'development') {
            message = err.message;
        }
        // Check for status code in error object
        if ('statusCode' in err && typeof err.statusCode === 'number') {
            statusCode = err.statusCode;
            message = err.message;
        }
    }
    return sendJsonError(res, message, statusCode);
};
exports.errorHandler = errorHandler;
// ============================================
// NOT FOUND HANDLER
// ============================================
const notFoundHandler = (req, res) => {
    sendJsonError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};
exports.notFoundHandler = notFoundHandler;
// ============================================
// ASYNC HANDLER WRAPPER
// ============================================
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map