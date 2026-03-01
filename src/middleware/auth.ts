// src/middleware/auth.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { authService } from '../modules/auth/auth.service';

const redis = getRedis();

const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 120; // 120 seconds

const cookieOptions = (isRefresh: boolean = false) => {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000,
    path: '/',
  };
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';
    // 1. Check Header (Authorization or authorization)
    const authHeader = req.headers.authorization || (req.headers as any).Authorization;
    if (authHeader && /^Bearer /i.test(authHeader)) {
      token = authHeader.split(' ')[1];
    }
    // 2. Check Alternative Headers
    else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'] as string;
    }
    // 3. Check Cookies
    else if (req.cookies?.accessToken || req.cookies?.token) {
      token = req.cookies.accessToken || req.cookies.token;
    }
    // 4. Check Query Parameter (as a last resort)
    else if (req.query.token) {
      token = req.query.token as string;
    }

    // 🔄 AUTO-HEALING: If no access token but refresh cookie exists
    if (!token && req.cookies?.refreshToken) {
      try {
        console.log('🛡️ Auto-healing: Missing access token but found refresh cookie. Attempting background refresh...');
        const newTokens = await authService.refreshToken(req.cookies.refreshToken);

        // Success! Set new cookies and use the new access token
        res.cookie('refreshToken', newTokens.refreshToken, cookieOptions(true));
        res.cookie('accessToken', newTokens.accessToken, cookieOptions(false));
        res.setHeader('x-new-access-token', newTokens.accessToken);
        res.setHeader('x-token-refreshed', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token, x-token-refreshed');

        token = newTokens.accessToken;
        console.log('✅ Auto-healing: Session restored silently and synced.');
      } catch (refreshError) {
        console.warn('❌ Auto-healing failed:', (refreshError as Error).message);
        // Fall through to 401 handling
      }
    }

    if (!token) {
      console.warn(`🔒 Auth failed: No token found. Cookies received: ${JSON.stringify(Object.keys(req.cookies || {}))}`, {
        url: req.originalUrl,
        headers: Object.keys(req.headers),
        query: Object.keys(req.query)
      });
      throw new AppError('Access token required', 401);
    }

    // Verify token
    const decoded = verifyAccessToken(token) as TokenPayload;

    // ✅ Distributed Caching for Production
    let user: any = null;

    if (redis) {
      const cachedUser = await redis.get(`${USER_CACHE_PREFIX}${decoded.userId}`);
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    }

    if (!user) {
      // Check if user exists
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          status: true,
          emailVerified: true,
        },
      });

      if (user && redis) {
        // Cache user status for 2 minutes to reduce DB hits
        await redis.set(
          `${USER_CACHE_PREFIX}${decoded.userId}`,
          JSON.stringify(user),
          'EX',
          CACHE_TTL
        );
      }
    }

    if (!user) {
      throw new AppError('User not found', 401);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended', 403);
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      organizationId: decoded.organizationId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireEmailVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      throw new AppError('Email verification required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.organizationId) {
      throw new AppError('Organization context required', 400);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    req.organization = organization;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = verifyAccessToken(token) as TokenPayload;

        const user = await prisma.user.findUnique({
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
      } catch {
        // Token invalid, continue without user
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};