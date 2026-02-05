// src/modules/admin/admin.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
}

interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Admin access token required', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as AdminTokenPayload;

    // Check if admin exists and is active
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
    });

    if (!admin) {
      throw new AppError('Admin not found', 401);
    }

    if (!admin.isActive) {
      throw new AppError('Admin account is disabled', 403);
    }

    // Attach admin to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    }
    next(error);
  }
};

export const requireSuperAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin) {
    return next(new AppError('Authentication required', 401));
  }

  if (req.admin.role !== 'super_admin') {
    return next(new AppError('Super admin access required', 403));
  }

  next();
};

export const generateAdminToken = (admin: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    },
    config.jwt.secret,
    { expiresIn: '24h' }
  );
};