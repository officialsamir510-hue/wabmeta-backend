"use strict";
// src/middleware/rateLimit.ts - ENHANCED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignLimiter = exports.apiLimiter = exports.authRateLimit = exports.authLimiter = exports.createRateLimiter = exports.rateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.rateLimit = express_rate_limit_1.default;
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const redis_1 = require("../config/redis");
// ✅ Use Redis for distributed rate limiting
const redis = (0, redis_1.getRedis)();
const createRateLimiter = (options) => {
    const limiterConfig = {
        windowMs: options.windowMs,
        max: options.max,
        message: options.message || 'Too many requests',
        standardHeaders: true,
        legacyHeaders: false,
    };
    // ✅ Use Redis if available
    if (redis) {
        limiterConfig.store = new rate_limit_redis_1.default({
            sendCommand: (...args) => redis.call(args[0], ...args.slice(1)),
            prefix: 'rl:',
        });
    }
    return (0, express_rate_limit_1.default)(limiterConfig);
};
exports.createRateLimiter = createRateLimiter;
// ✅ Define limiters with names expected by routes
exports.authLimiter = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 min
    message: 'Too many login attempts',
});
// Alias for routes that use 'authRateLimit'
exports.authRateLimit = exports.authLimiter;
exports.apiLimiter = (0, exports.createRateLimiter)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
});
exports.campaignLimiter = (0, exports.createRateLimiter)({
    windowMs: 1 * 60 * 1000,
    max: 10, // 10 campaign starts per minute
});
//# sourceMappingURL=rateLimit.js.map