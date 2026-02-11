"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaginated = exports.paginatedResponse = exports.validationErrorResponse = exports.errorResponse = exports.successResponse = exports.sendError = exports.sendSuccess = void 0;
// ✅ sendSuccess - Supports multiple call patterns
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    const response = {
        success: true,
        message,
        data,
    };
    return res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
// ✅ sendError - Supports multiple call patterns
const sendError = (res, message = 'An error occurred', statusCode = 400, error) => {
    const response = {
        success: false,
        message,
        error: error?.message || error,
    };
    return res.status(statusCode).json(response);
};
exports.sendError = sendError;
// successResponse - Object based version
const successResponse = (res, options) => {
    const { data, message = 'Success', meta, statusCode = 200 } = options;
    const response = {
        success: true,
        message,
        data,
        meta,
    };
    return res.status(statusCode).json(response);
};
exports.successResponse = successResponse;
// errorResponse - Object based version
const errorResponse = (res, message = 'An error occurred', statusCode = 400, error) => {
    const response = {
        success: false,
        message,
        error: error?.message || error,
    };
    return res.status(statusCode).json(response);
};
exports.errorResponse = errorResponse;
const validationErrorResponse = (res, errors) => {
    const response = {
        success: false,
        message: 'Validation failed',
        errors,
    };
    return res.status(422).json(response);
};
exports.validationErrorResponse = validationErrorResponse;
const paginatedResponse = (res, options) => {
    const { data, page, limit, total, message = 'Success' } = options;
    const response = {
        success: true,
        message,
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
    return res.status(200).json(response);
};
exports.paginatedResponse = paginatedResponse;
const sendPaginated = (res, data, pagination, message = 'Success') => {
    return (0, exports.paginatedResponse)(res, {
        data,
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        message,
    });
};
exports.sendPaginated = sendPaginated;
//# sourceMappingURL=response.js.map