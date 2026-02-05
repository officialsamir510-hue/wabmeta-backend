// src/modules/admin/admin.middleware.ts

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';
import { AuthRequest } from '../../types/express';

interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
  type: 'admin';
}

// Extend AuthRequest for admin
export interface AdminRequest extends AuthRequest {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

// Authenticate admin
export const authenticateAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Admin access token required', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token using config.jwt.secret
    const decoded = jwt.verify(token, config.jwt.secret) as AdminTokenPayload;

    if (decoded.type !== 'admin') {
      throw new AppError('Invalid admin token', 401);
    }

    // Check if admin exists
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
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
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid admin token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Admin token expired', 401));
    } else {
      next(error);
    }
  }
};

// Require super admin role
export const requireSuperAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      throw new AppError('Admin authentication required', 401);
    }

    if (req.admin.role !== 'super_admin') {
      throw new AppError('Super admin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Generate admin token
export const generateAdminToken = (admin: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    },
    config.jwt.secret,
    { expiresIn: '24h' }
  );
};