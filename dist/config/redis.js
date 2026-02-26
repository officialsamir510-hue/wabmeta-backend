"use strict";
// src/config/redis.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = exports.getRedis = exports.initRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = require("./index");
let redis = null;
const initRedis = () => {
    if (!index_1.config.redis.url) {
        console.warn('⚠️ Redis not configured, using in-memory cache');
        return null;
    }
    redis = new ioredis_1.default(index_1.config.redis.url, {
        maxRetriesPerRequest: 3,
        tls: index_1.config.redis.url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        reconnectOnError(err) {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
                return true;
            }
            return false;
        },
    });
    redis.on('connect', () => {
        console.log('✅ Redis connected');
    });
    redis.on('error', (err) => {
        console.error('❌ Redis error:', err);
    });
    return redis;
};
exports.initRedis = initRedis;
const getRedis = () => {
    return redis;
};
exports.getRedis = getRedis;
const closeRedis = async () => {
    if (redis) {
        await redis.quit();
        console.log('✅ Redis closed');
    }
};
exports.closeRedis = closeRedis;
exports.default = { initRedis: exports.initRedis, getRedis: exports.getRedis, closeRedis: exports.closeRedis };
//# sourceMappingURL=redis.js.map