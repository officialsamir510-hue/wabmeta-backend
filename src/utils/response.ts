// src/utils/response.ts
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const successResponse = <T = any>(
  res: Response,
  options: {
    data?: T;
    message?: string;
    meta?: any;
    statusCode?: number;
  }
): Response => {
  const { data, message = 'Success', meta, statusCode = 200 } = options;

  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };

  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  error?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    error: error?.message || error,
  };

  return res.status(statusCode).json(response);
};

export const validationErrorResponse = (
  res: Response,
  errors: any[]
): Response => {
  const response: ApiResponse = {
    success: false,
    message: 'Validation failed',
    errors,
  };

  return res.status(422).json(response);
};

export const paginatedResponse = <T = any>(
  res: Response,
  options: {
    data: T[];
    page: number;
    limit: number;
    total: number;
    message?: string;
  }
): Response => {
  const { data, page, limit, total, message = 'Success' } = options;

  const response: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  return res.status(200).json(response);
};