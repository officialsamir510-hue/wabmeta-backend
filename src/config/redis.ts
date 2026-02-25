// src/config/redis.ts

import Redis from 'ioredis';
import { config } from './index';

let redis: Redis | null = null;

export const initRedis = () => {
    if (!config.redis.url) {
        console.warn('⚠️ Redis not configured, using in-memory cache');
        return null;
    }

    redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
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

export const getRedis = (): Redis | null => {
    return redis;
};

export const closeRedis = async () => {
    if (redis) {
        await redis.quit();
        console.log('✅ Redis closed');
    }
};

export default { initRedis, getRedis, closeRedis };
