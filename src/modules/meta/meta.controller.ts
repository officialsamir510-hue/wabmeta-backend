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

// ============================================
// AUTH URL GENERATION
// ============================================

/**
 * GET /api/v1/meta/auth/url
 * Generate Meta OAuth URL with mode selection
 */
export const getAuthUrl = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    
    // ✅ Get mode from query param (new/existing/both)
    const mode = (req.query.mode as string) || 'both';

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!config.meta?.appId) {
      console.error('❌ Meta app ID missing');
      return sendError(res, 'Meta app not configured', 500);
    }

    // Generate state for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7),
        mode
      })
    ).toString('base64');

    const version = config.meta.graphApiVersion.replace(/^v/, '');
    const redirectUri = encodeURIComponent(
      config.meta.redirectUri || `${config.frontendUrl}/meta/callback`
    );

    // ✅ Base OAuth URL
    let authUrl = `https://www.facebook.com/v${version}/dialog/oauth` +
      `?client_id=${config.meta.appId}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}` +
      `&response_type=code` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging,business_management`;

    // ✅ MODE-BASED URL GENERATION
    if (mode === 'new') {
      // Force new setup with Embedded Signup
      if (config.meta.configId) {
        authUrl += `&config_id=${config.meta.configId}`;
        authUrl += `&extras=${encodeURIComponent(JSON.stringify({
          setup: {},
          feature: 'whatsapp_embedded_signup',
          featureType: 'whatsapp_embedded_signup'
        }))}`;
        console.log('🆕 New WhatsApp setup URL (Embedded Signup)');
      } else {
        console.warn('⚠️ Config ID not set, falling back to standard OAuth');
        authUrl += `&display=popup`;
      }
      
    } else if (mode === 'existing') {
      // Standard OAuth - shows existing accounts
      // NO config_id - important!
      authUrl += `&display=popup`;
      console.log('📱 Existing WhatsApp connection URL');
      
    } else {
      // Default: Standard OAuth (shows both options)
      // NO config_id - user can choose
      authUrl += `&display=popup`;
      authUrl += `&auth_type=rerequest`; // Re-ask for permissions
      console.log('🔄 Both options URL (Standard OAuth)');
    }

    console.log('🔗 Generated Meta auth URL:');
    console.log('   Mode:', mode);
    console.log('   Version:', version);
    console.log('   App ID:', config.meta.appId);
    if (mode === 'new' && config.meta.configId) {
      console.log('   Config ID:', config.meta.configId);
    }
    console.log('   Redirect:', config.meta.redirectUri);

    sendSuccess(res, { 
      url: authUrl,
      authUrl,
      state,
      mode,
      redirectUri: config.meta.redirectUri
    }, 'Auth URL generated successfully');

  } catch (error: any) {
    console.error('❌ Get auth URL error:', error);
    sendError(res, error.message || 'Failed to generate auth URL', 500);
  }
};

/**
 * GET /api/v1/meta/auth/url/fallback
 * Get fallback URL (Standard OAuth)
 */
export const getFallbackUrl = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!config.meta?.appId) {
      return sendError(res, 'Meta app not configured', 500);
    }

    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7),
        mode: 'standard'
      })
    ).toString('base64');

    const version = config.meta.graphApiVersion.replace(/^v/, '');
    const redirectUri = encodeURIComponent(
      config.meta.redirectUri || `${config.frontendUrl}/meta/callback`
    );

    // Standard OAuth Only
    const authUrl = `https://www.facebook.com/v${version}/dialog/oauth` +
      `?client_id=${config.meta.appId}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}` +
      `&response_type=code` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging,business_management` +
      `&display=popup`;

    console.log('🔄 Fallback URL generated (Standard OAuth)');

    sendSuccess(res, { 
      url: authUrl,
      state,
      mode: 'standard'
    }, 'Fallback URL generated');

  } catch (error: any) {
    console.error('❌ Get fallback URL error:', error);
    sendError(res, error.message || 'Failed to generate fallback URL', 500);
  }
};

// ============================================
// OAUTH CALLBACKS
// ============================================

/**
 * GET /api/v1/meta/callback
 * Handle OAuth callback via redirect
 */
export const handleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    console.log('🔗 Meta OAuth callback received (GET)');
    console.log('   Code:', code ? 'present' : 'missing');
    console.log('   State:', state ? 'present' : 'missing');
    console.log('   Error:', error || 'none');

    // Handle OAuth errors from Meta
    if (error) {
      console.error('❌ OAuth error from Meta:', error, error_description);
      const errorMsg = encodeURIComponent(
        String(error_description || error || 'Authorization denied')
      );
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?tab=whatsapp&error=${errorMsg}`
      );
    }

    if (!code || !state) {
      console.error('❌ Missing code or state in callback');
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?tab=whatsapp&error=missing_params`
      );
    }

    // Decode state to get organization ID
    let organizationId: string;
    let mode = 'both';
    
    try {
      const decodedState = JSON.parse(
        Buffer.from(state as string, 'base64').toString()
      );
      organizationId = decodedState.organizationId;
      mode = decodedState.mode || 'both';

      if (!organizationId) {
        throw new Error('Organization ID not found in state');
      }
    } catch (e) {
      console.error('❌ Failed to decode state:', e);
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings?tab=whatsapp&error=invalid_state`
      );
    }

    console.log(`🔗 Processing ${mode} OAuth redirect for org:`, organizationId);

    // Connect Meta account
    await MetaService.connectEmbeddedSignup(
      organizationId,
      code as string,
      state as string
    );

    console.log('✅ Meta account connected via redirect');

    // Redirect to success page
    res.redirect(`${config.frontendUrl}/dashboard/settings?tab=whatsapp&meta_connected=true`);
  } catch (error: any) {
    console.error('❌ Callback redirect error:', error);
    const errorMsg = encodeURIComponent(error.message || 'Connection failed');
    res.redirect(`${config.frontendUrl}/dashboard/settings?tab=whatsapp&error=${errorMsg}`);
  }
};

/**
 * POST /api/v1/meta/auth/callback
 * Handle OAuth callback from frontend popup
 */
export const handleAuthCallbackPost = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { code, state, error, error_description } = req.body;

    console.log('🔗 Meta OAuth callback received (POST)');
    console.log('   Organization:', organizationId);
    console.log('   Code:', code ? code.substring(0, 20) + '...' : 'missing');

    if (error) {
      return sendError(res, error_description || error, 400);
    }

    if (!code) {
      return sendError(res, 'Authorization code is required', 400);
    }

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    const connection = await MetaService.connectEmbeddedSignup(
      organizationId,
      code,
      state
    );

    console.log('✅ Meta account connected via POST callback');

    sendSuccess(res, connection, 'Meta account connected successfully');
  } catch (error: any) {
    console.error('❌ POST Callback error:', error);
    sendError(
      res,
      error.message || 'Failed to connect Meta account',
      error.statusCode || 500
    );
  }
};

/**
 * POST /api/v1/meta/connect
 * Connect Meta account (Standard Endpoint)
 */
export const connectMeta = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { code, state } = req.body;

    console.log('🔗 Meta connect request received:');
    console.log('   Organization:', organizationId);
    console.log('   Code:', code ? code.substring(0, 20) + '...' : 'MISSING');

    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }

    if (!code) {
      return sendError(res, 'Authorization code is required', 400);
    }

    const connection = await MetaService.connectEmbeddedSignup(
      organizationId,
      code,
      state
    );

    console.log('✅ Meta connection successful');
    console.log('   Connection ID:', connection.id);
    console.log('   WABA ID:', connection.wabaId);
    console.log('   Phone Numbers:', connection.phoneNumbers?.length || 0);

    sendSuccess(res, connection, 'Meta account connected successfully');
  } catch (error: any) {
    console.error('❌ Meta connect error:', error);
    sendError(res, error.message || 'Failed to connect Meta account', error.statusCode || 500);
  }
};

// ============================================
// CONNECTION MANAGEMENT
// ============================================

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

    if (error.code === 'P2024') {
      return sendError(res, 'Database temporarily unavailable. Please try again.', 503);
    }

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

// ============================================
// PHONE NUMBER MANAGEMENT
// ============================================

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

// ============================================
// BUSINESS ACCOUNTS
// ============================================

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

// ============================================
// MESSAGING
// ============================================

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

export function handleCallbackRedirect(arg0: string, handleCallbackRedirect: any) {
  throw new Error('Function not implemented.');
}
