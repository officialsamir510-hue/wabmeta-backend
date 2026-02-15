// src/utils/response.ts

import { Response } from 'express';

export const successResponse = (
  res: Response,
  data: any,
  statusCode: number = 200,
  message?: string
) => {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Success',
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 400,
  errors?: any
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

export default {
  successResponse,
  errorResponse,
};