"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimit = exports.rateLimit = void 0;
const response_1 = require("../utils/response");
const store = {};
const rateLimit = (options = {}) => {
    const { windowMs = 60 * 1000, // 1 minute
    max = 100, message = 'Too many requests, please try again later', } = options;
    // Cleanup old entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const key in store) {
            if (store[key].resetAt < now) {
                delete store[key];
            }
        }
    }, windowMs);
    return (req, res, next) => {
        const key = req.ip || 'unknown';
        const now = Date.now();
        if (!store[key] || store[key].resetAt < now) {
            store[key] = {
                count: 1,
                resetAt: now + windowMs,
            };
            return next();
        }
        store[key].count++;
        if (store[key].count > max) {
            const retryAfter = Math.ceil((store[key].resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return (0, response_1.sendError)(res, message, 429);
        }
        next();
    };
};
exports.rateLimit = rateLimit;
// Stricter rate limit for auth routes
exports.authRateLimit = (0, exports.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
    message: 'Too many login attempts, please try again after 15 minutes',
});
//# sourceMappingURL=rateLimit.js.map