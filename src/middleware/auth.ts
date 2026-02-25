// src/middleware/auth.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { getRedis } from '../config/redis';

const redis = getRedis();
const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 120; // 120 seconds

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.split(' ')[1];

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