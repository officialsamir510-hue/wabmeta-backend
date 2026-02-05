import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ✅ Safe logger (console.error ko crash hone se bachata hai)
const logErrorSafe = (err: unknown) => {
  try {
    if (err instanceof Error) {
      console.error(err.stack || err.message);
      return;
    }
    // fallback
    console.error(typeof err === 'string' ? err : JSON.stringify(err));
  } catch {
    console.error('Unknown error (failed to log safely)');
  }
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  logErrorSafe(err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Validation failed', 400, errors);
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const field = (err.meta?.target as string[])?.[0] || 'field';
        return sendError(res, `This ${field} already exists`, 409);
      }
      case 'P2025':
        return sendError(res, 'Record not found', 404);
      default:
        return sendError(res, 'Database error', 500, { code: err.code });
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return sendError(res, 'Database connection failed', 500);
  }

  // Custom AppError
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // JWT errors
  if (typeof err === 'object' && err && 'name' in err) {
    const name = (err as any).name;
    if (name === 'JsonWebTokenError') return sendError(res, 'Invalid token', 401);
    if (name === 'TokenExpiredError') return sendError(res, 'Token expired', 401);
  }

  // Default error
  const message =
    config.nodeEnv === 'development'
      ? (err instanceof Error ? err.message : 'Unknown error')
      : 'Internal server error';

  return sendError(res, message, 500);
};