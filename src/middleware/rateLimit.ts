// src/middleware/rateLimit.ts - ENHANCED

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedis } from '../config/redis';

// ✅ Export rateLimit for compatibility with routes
export { rateLimit };

// ✅ Use Redis for distributed rate limiting
const redis = getRedis();

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  const limiterConfig: any = {
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
  };

  // ✅ Use Redis if available
  if (redis) {
    limiterConfig.store = new (RedisStore as any)({
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
      prefix: 'rl:',
    });
  }

  return rateLimit(limiterConfig);
};

// ✅ Define limiters with names expected by routes
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 min
  message: 'Too many login attempts',
});

// Alias for routes that use 'authRateLimit'
export const authRateLimit = authLimiter;

export const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

export const campaignLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10, // 10 campaign starts per minute
});