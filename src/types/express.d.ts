// src/types/express.d.ts

import { Request } from 'express';
import { Organization } from '@prisma/client';

// JWT Token Payload
export interface TokenPayload {
  userId: string;
  email: string;
  organizationId?: string;
  type?: 'access' | 'refresh';
}

// User object attached to request
export interface RequestUser {
  id: string;
  email: string;
  organizationId?: string;
}

// Extended Auth Request
export interface AuthRequest extends Request {
  user?: RequestUser;
  organization?: Organization;
}

// Augment Express Request globally
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      organization?: Organization;
    }
  }
}

export {};