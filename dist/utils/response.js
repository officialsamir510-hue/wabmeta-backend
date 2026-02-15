"use strict";
// src/utils/response.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = (res, data, statusCode = 200, message) => {
    return res.status(statusCode).json({
        success: true,
        message: message || 'Success',
        data,
    });
};
exports.successResponse = successResponse;
const errorResponse = (res, message, statusCode = 400, errors) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};
exports.errorResponse = errorResponse;
exports.default = {
    successResponse: exports.successResponse,
    errorResponse: exports.errorResponse,
};
//# sourceMappingURL=response.js.map