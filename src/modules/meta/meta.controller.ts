// src/modules/meta/meta.controller.ts

import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { sendSuccess, sendError } from '../../utils/response';

/**
 * POST /api/v1/meta/connect
 * Connect Meta account via Embedded Signup
 */
export const connectMeta = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const { code, state } = req.body;

    if (!code) {
      return sendError(res, 'Authorization code is required', 400);
    }

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    console.log('🔗 Meta connect request:');
    console.log('   Organization:', organizationId);
    console.log('   Code:', code.substring(0, 20) + '...');
    console.log('   State:', state);

    const connection = await MetaService.connectEmbeddedSignup(
      organizationId,
      code,
      state
    );

    sendSuccess(res, connection, 'Meta account connected successfully', 200);
  } catch (error: any) {
    console.error('Meta connect error:', error);
    sendError(res, error.message || 'Failed to connect Meta account', error.statusCode || 500);
  }
};

/**
 * GET /api/v1/meta/status
 * Get connection status
 */
export const getConnectionStatus = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const status = await MetaService.getConnectionStatus(organizationId);
    
    sendSuccess(res, status, 'Connection status retrieved');
  } catch (error: any) {
    console.error('Get connection status error:', error);
    sendError(res, error.message);
  }
};

/**
 * POST /api/v1/meta/disconnect
 * Disconnect Meta account
 */
export const disconnect = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const result = await MetaService.disconnect(organizationId);
    
    sendSuccess(res, result, 'Meta account disconnected');
  } catch (error: any) {
    console.error('Disconnect error:', error);
    sendError(res, error.message);
  }
};

/**
 * POST /api/v1/meta/refresh
 * Refresh connection data
 */
export const refreshConnection = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const status = await MetaService.refreshConnection(organizationId);
    
    sendSuccess(res, status, 'Connection refreshed successfully');
  } catch (error: any) {
    console.error('Refresh connection error:', error);
    sendError(res, error.message);
  }
};