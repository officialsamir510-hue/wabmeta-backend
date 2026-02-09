// src/modules/meta/meta.controller.ts

import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { sendSuccess, sendError } from '../../utils/response';
import { config } from '../../config';

// Extended Request interface with user info
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

/**
 * GET /api/v1/meta/auth/url
 * Generate Meta OAuth URL for Embedded Signup
 */
export const getAuthUrl = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    // Validate Meta configuration
    if (!config.meta?.appId || !config.meta?.configId) {
      console.error('❌ Meta config missing:', {
        appId: !!config.meta?.appId,
        configId: !!config.meta?.configId,
      });
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
        random: Math.random().toString(36).substring(7),
      })
    ).toString('base64');

    // Build redirect URI
    const redirectUri =
      config.meta.redirectUri || `${config.frontendUrl}/meta/callback`;

    // ✅ FIXED: Remove 'v' prefix if already present in version
    const version = (config.meta.graphApiVersion || '21.0').replace(/^v/, '');

    // Embedded Signup OAuth URL
    const authUrl =
      `https://www.facebook.com/v${version}/dialog/oauth` +
      `?client_id=${config.meta.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&config_id=${config.meta.configId}` +
      `&response_type=code` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging,business_management`;

    console.log('🔗 Generated Meta auth URL:');
    console.log('   Organization:', organizationId);
    console.log('   Version:', version);
    console.log('   App ID:', config.meta.appId);
    console.log('   Config ID:', config.meta.configId);
    console.log('   Redirect URI:', redirectUri);

    sendSuccess(
      res,
      {
        url: authUrl,
        authUrl, // Include both for compatibility
        state,
        redirectUri,
      },
      'Auth URL generated successfully'
    );
  } catch (error: any) {
    console.error('❌ Get auth URL error:', error);
    sendError(res, error.message || 'Failed to generate auth URL', 500);
  }
};

/**
 * POST /api/v1/meta/auth/callback
 * Handle OAuth callback from frontend (receives code and state)
 */
export const handleAuthCallback = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { code, state } = req.body;

    if (!code) {
      return sendError(res, 'Authorization code is required', 400);
    }

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    console.log('🔗 Meta auth callback:');
    console.log('   Organization:', organizationId);
    console.log('   Code:', code.substring(0, 20) + '...');
    console.log('   State:', state ? state.substring(0, 20) + '...' : 'none');

    // Verify state token if provided
    if (state) {
      try {
        const decodedState = JSON.parse(
          Buffer.from(state, 'base64').toString()
        );
        if (
          decodedState.organizationId &&
          decodedState.organizationId !== organizationId
        ) {
          console.warn('⚠️ State organization mismatch');
          // Continue anyway - the auth token will determine the actual org
        }
      } catch (e) {
        console.warn('⚠️ State verification skipped (invalid format)');
      }
    }

    // Connect via embedded signup
    const connection = await MetaService.connectEmbeddedSignup(
      organizationId,
      code,
      state
    );

    console.log('✅ Meta account connected successfully');

    sendSuccess(res, connection, 'Meta account connected successfully');
  } catch (error: any) {
    console.error('❌ Meta auth callback error:', error);
    sendError(
      res,
      error.message || 'Failed to connect Meta account',
      error.statusCode || 500
    );
  }
};

/**
 * GET /api/v1/meta/callback (Query params version)
 * Handle OAuth callback via redirect (receives code and state as query params)
 */
export const handleCallbackRedirect = async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors from Meta
    if (error) {
      console.error('❌ OAuth error from Meta:', error, error_description);
      const errorMsg = encodeURIComponent(
        String(error_description || error || 'Authorization denied')
      );
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?error=${errorMsg}`
      );
    }

    if (!code || !state) {
      console.error('❌ Missing code or state in callback');
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?error=missing_params`
      );
    }

    // Decode state to get organization ID
    let organizationId: string;
    try {
      const decodedState = JSON.parse(
        Buffer.from(state as string, 'base64').toString()
      );
      organizationId = decodedState.organizationId;

      if (!organizationId) {
        throw new Error('Organization ID not found in state');
      }
    } catch (e) {
      console.error('❌ Failed to decode state:', e);
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?error=invalid_state`
      );
    }

    console.log('🔗 Processing OAuth redirect callback for org:', organizationId);

    // Connect Meta account
    await MetaService.connectEmbeddedSignup(
      organizationId,
      code as string,
      state as string
    );

    console.log('✅ Meta account connected via redirect');

    // Redirect to success page
    res.redirect(`${config.frontendUrl}/dashboard/settings?meta_connected=true`);
  } catch (error: any) {
    console.error('❌ Callback redirect error:', error);
    const errorMsg = encodeURIComponent(error.message || 'Connection failed');
    res.redirect(`${config.frontendUrl}/dashboard/settings?error=${errorMsg}`);
  }
};

/**
 * POST /api/v1/meta/connect
 * Connect Meta account (alias for handleAuthCallback)
 */
export const connectMeta = handleAuthCallback;

/**
 * GET /api/v1/meta/status
 * Get Meta connection status
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
    console.error('❌ Get connection status error:', error);
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

    console.log('✅ Meta account disconnected for org:', organizationId);

    sendSuccess(res, result, 'Meta account disconnected');
  } catch (error: any) {
    console.error('❌ Disconnect error:', error);
    sendError(res, error.message || 'Failed to disconnect', 500);
  }
};

/**
 * POST /api/v1/meta/refresh
 * Refresh Meta connection data
 */
export const refreshConnection = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const status = await MetaService.refreshConnection(organizationId);

    console.log('✅ Meta connection refreshed for org:', organizationId);

    sendSuccess(res, status, 'Connection refreshed successfully');
  } catch (error: any) {
    console.error('❌ Refresh connection error:', error);
    sendError(res, error.message || 'Failed to refresh connection', 500);
  }
};

/**
 * GET /api/v1/meta/phone-numbers
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
    console.error('❌ Get phone numbers error:', error);
    sendError(res, error.message || 'Failed to get phone numbers', 500);
  }
};

/**
 * POST /api/v1/meta/phone-numbers/:phoneNumberId/register
 * Register a phone number for WhatsApp messaging
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

    const result = await MetaService.registerPhoneNumber(
      organizationId,
      phoneNumberId,
      pin
    );

    console.log('✅ Phone number registered:', phoneNumberId);

    sendSuccess(res, result, 'Phone number registered successfully');
  } catch (error: any) {
    console.error('❌ Register phone number error:', error);
    sendError(res, error.message || 'Failed to register phone number', 500);
  }
};

/**
 * POST /api/v1/meta/test-message
 * Send a test WhatsApp message
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

    const result = await MetaService.sendTestMessage(
      organizationId,
      phoneNumberId,
      to,
      message
    );

    console.log('✅ Test message sent to:', to);

    sendSuccess(res, result, 'Test message sent successfully');
  } catch (error: any) {
    console.error('❌ Send test message error:', error);
    sendError(res, error.message || 'Failed to send test message', 500);
  }
};

/**
 * GET /api/v1/meta/business-accounts
 * Get linked business accounts
 */
export const getBusinessAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const accounts = await MetaService.getBusinessAccounts(organizationId);

    sendSuccess(res, accounts, 'Business accounts retrieved');
  } catch (error: any) {
    console.error('❌ Get business accounts error:', error);
    sendError(res, error.message || 'Failed to get business accounts', 500);
  }
};

export function handleCallback(arg0: string, handleCallback: any) {
    throw new Error('Function not implemented.');
}
