import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs?: number;  // Time window in ms
  max?: number;       // Max requests per window
  message?: string;
}

export const rateLimit = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 60 * 1000,  // 1 minute
    max = 100,
    message = 'Too many requests, please try again later',
  } = options;

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
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
      return sendError(res, message, 429);
    }

    next();
  };
};

// Stricter rate limit for auth routes
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts
  message: 'Too many login attempts, please try again after 15 minutes',
});