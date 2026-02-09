// src/modules/meta/meta.controller.ts

import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { sendSuccess, sendError } from '../../utils/response';
import { config } from '../../config';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

/**
 * ✅ NEW: GET /api/v1/meta/auth/url
 * Generate Meta OAuth URL for Embedded Signup
 */
export const getAuthUrl = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!config.meta?.appId || !config.meta?.configId) {
      return sendError(
        res,
        'Meta app configuration is incomplete. Please contact support.',
        500
      );
    }

    // Generate state token (for CSRF protection)
    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7)
      })
    ).toString('base64');

    // Build redirect URI
    const redirectUri = config.meta.redirectUri || `${config.frontendUrl}/meta/callback`;

    // Embedded Signup URL
    const authUrl = `https://www.facebook.com/v${config.meta.graphApiVersion || '21.0'}/dialog/oauth` +
      `?client_id=${config.meta.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&config_id=${config.meta.configId}` +
      `&response_type=code` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging,business_management`;

    console.log('🔗 Generated Meta auth URL for org:', organizationId);

    sendSuccess(res, { 
      url: authUrl,
      state,
      redirectUri
    }, 'Auth URL generated successfully');

  } catch (error: any) {
    console.error('Get auth URL error:', error);
    sendError(res, error.message || 'Failed to generate auth URL', 500);
  }
};

/**
 * POST /api/v1/meta/connect
 * Connect Meta account via Embedded Signup
 */
export const connectMeta = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
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

    // Optional: Verify state token
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        if (decodedState.organizationId && decodedState.organizationId !== organizationId) {
          console.warn('⚠️ State organization mismatch, but proceeding...');
        }
      } catch (e) {
        console.warn('State verification skipped:', e);
      }
    }

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
export const getConnectionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const status = await MetaService.getConnectionStatus(organizationId);
    
    sendSuccess(res, status, 'Connection status retrieved');
  } catch (error: any) {
    console.error('Get connection status error:', error);
    sendError(res, error.message || 'Failed to get connection status', 500);
  }
};

/**
 * POST /api/v1/meta/disconnect
 * Disconnect Meta account
 */
export const disconnect = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const result = await MetaService.disconnect(organizationId);
    
    sendSuccess(res, result, 'Meta account disconnected');
  } catch (error: any) {
    console.error('Disconnect error:', error);
    sendError(res, error.message || 'Failed to disconnect', 500);
  }
};

/**
 * POST /api/v1/meta/refresh
 * Refresh connection data
 */
export const refreshConnection = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const status = await MetaService.refreshConnection(organizationId);
    
    sendSuccess(res, status, 'Connection refreshed successfully');
  } catch (error: any) {
    console.error('Refresh connection error:', error);
    sendError(res, error.message || 'Failed to refresh connection', 500);
  }
};

/**
 * ✅ NEW: GET /api/v1/meta/callback
 * Handle OAuth callback (alternative to frontend handling)
 */
export const handleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, error_description);
      const errorMsg = encodeURIComponent(String(error_description || error));
      return res.redirect(`${config.frontendUrl}/dashboard/settings?error=${errorMsg}`);
    }

    if (!code || !state) {
      console.error('Missing code or state in callback');
      return res.redirect(`${config.frontendUrl}/dashboard/settings?error=missing_params`);
    }

    // Decode state to get organization ID
    let organizationId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString());
      organizationId = decodedState.organizationId;
      
      if (!organizationId) {
        throw new Error('Organization ID not found in state');
      }
    } catch (e) {
      console.error('Failed to decode state:', e);
      return res.redirect(`${config.frontendUrl}/dashboard/settings?error=invalid_state`);
    }

    console.log('🔗 Processing OAuth callback for org:', organizationId);

    // Connect Meta account
    await MetaService.connectEmbeddedSignup(organizationId, code as string, state as string);

    // Redirect to success page
    res.redirect(`${config.frontendUrl}/dashboard/settings?meta_connected=true`);

  } catch (error: any) {
    console.error('Callback error:', error);
    const errorMsg = encodeURIComponent(error.message || 'Connection failed');
    res.redirect(`${config.frontendUrl}/dashboard/settings?error=${errorMsg}`);
  }
};

/**
 * ✅ NEW: GET /api/v1/meta/phone-numbers
 * Get connected phone numbers
 */
export const getPhoneNumbers = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const phoneNumbers = await MetaService.getPhoneNumbers(organizationId);
    
    sendSuccess(res, phoneNumbers, 'Phone numbers retrieved');
  } catch (error: any) {
    console.error('Get phone numbers error:', error);
    sendError(res, error.message || 'Failed to get phone numbers', 500);
  }
};

/**
 * ✅ NEW: POST /api/v1/meta/phone-numbers/:phoneNumberId/register
 * Register a phone number for messaging
 */
export const registerPhoneNumber = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { phoneNumberId } = req.params;
    const { pin } = req.body;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!phoneNumberId) {
      return sendError(res, 'Phone number ID is required', 400);
    }

    const result = await MetaService.registerPhoneNumber(organizationId, phoneNumberId, pin);
    
    sendSuccess(res, result, 'Phone number registered successfully');
  } catch (error: any) {
    console.error('Register phone number error:', error);
    sendError(res, error.message || 'Failed to register phone number', 500);
  }
};

/**
 * ✅ NEW: POST /api/v1/meta/test-message
 * Send a test message
 */
export const sendTestMessage = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { phoneNumberId, to, message } = req.body;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!phoneNumberId || !to || !message) {
      return sendError(res, 'phoneNumberId, to, and message are required', 400);
    }

    const result = await MetaService.sendTestMessage(organizationId, phoneNumberId, to, message);
    
    sendSuccess(res, result, 'Test message sent successfully');
  } catch (error: any) {
    console.error('Send test message error:', error);
    sendError(res, error.message || 'Failed to send test message', 500);
  }
};