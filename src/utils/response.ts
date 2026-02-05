import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: Omit<ApiResponse<T>, 'success'>
): Response => {
  const success = statusCode >= 200 && statusCode < 300;
  
  return res.status(statusCode).json({
    success,
    ...data,
  });
};

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response => {
  return sendResponse(res, statusCode, { data, message });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  error?: any
): Response => {
  return sendResponse(res, statusCode, { message, error });
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message?: string
): Response => {
  return sendResponse(res, 200, {
    data,
    message,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
};