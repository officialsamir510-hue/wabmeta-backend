// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as metaController from './meta.controller';
import { Request, Response } from 'express';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// These handle OAuth callbacks from Meta
// ============================================

/**
 * @route   GET /api/v1/meta/callback
 * @desc    Handle OAuth callback redirect from Meta
 * @access  Public (redirected from Meta)
 * @note    This processes the auth code via query params and redirects user
 */
router.get('/callback', metaController.handleCallbackRedirect);

/**
 * @route   POST /api/v1/meta/auth/callback
 * @desc    Handle OAuth callback from frontend popup
 * @access  Private (frontend sends code after popup closes)
 * @note    Requires auth because frontend sends stored JWT
 */
router.post('/auth/callback', authenticate, metaController.handleAuthCallback);

// ============================================
// AUTH URL GENERATION
// ============================================

/**
 * @route   GET /api/v1/meta/auth/url
 * @desc    Generate Meta OAuth URL for Embedded Signup
 * @access  Private
 * @returns { url: string, state: string, redirectUri: string }
 */
router.get('/auth/url', authenticate, metaController.getAuthUrl);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Apply authentication middleware to all routes below
router.use(authenticate);

/**
 * @route   POST /api/v1/meta/connect
 * @desc    Connect Meta account via authorization code
 * @access  Private
 * @body    { code: string, state?: string }
 */
router.post('/connect', metaController.connectMeta);

/**
 * @route   GET /api/v1/meta/status
 * @desc    Get Meta connection status
 * @access  Private
 * @returns { isConnected: boolean, wabaId?: string, phoneNumbers?: array, ... }
 */
router.get('/status', metaController.getConnectionStatus);

/**
 * @route   POST /api/v1/meta/refresh
 * @desc    Refresh Meta connection data (sync phone numbers, etc.)
 * @access  Private
 */
router.post('/refresh', metaController.refreshConnection);

/**
 * @route   POST /api/v1/meta/disconnect
 * @desc    Disconnect Meta account
 * @access  Private
 */
router.post('/disconnect', metaController.disconnect);

// ============================================
// PHONE NUMBER MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/meta/phone-numbers
 * @desc    Get connected phone numbers
 * @access  Private
 * @returns Array of phone numbers with status
 */
router.get('/phone-numbers', metaController.getPhoneNumbers);

/**
 * @route   POST /api/v1/meta/phone-numbers/:phoneNumberId/register
 * @desc    Register a phone number for WhatsApp messaging
 * @access  Private
 * @param   phoneNumberId - Meta phone number ID
 * @body    { pin?: string } - Optional 6-digit PIN
 */
router.post(
  '/phone-numbers/:phoneNumberId/register',
  metaController.registerPhoneNumber
);

// ============================================
// BUSINESS ACCOUNT MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/meta/business-accounts
 * @desc    Get linked Meta Business Accounts
 * @access  Private
 */
router.get('/business-accounts', metaController.getBusinessAccounts);

// ============================================
// MESSAGING
// ============================================

/**
 * @route   POST /api/v1/meta/test-message
 * @desc    Send a test WhatsApp message
 * @access  Private
 * @body    { phoneNumberId: string, to: string, message: string }
 */
router.post('/test-message', metaController.sendTestMessage);

export default router;
/**
 * Handles the OAuth callback redirect from Meta.
 * Expects ?code and ?state in the query params.
 * Redirects the user to the frontend with the code/state or an error.
 */

export const handleCallbackRedirect = (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Define your frontend redirect URI (could be from config/env)
  const frontendRedirectUri = process.env.META_OAUTH_FRONTEND_REDIRECT || 'https://your-frontend-app.com/meta/oauth/callback';

  if (error) {
    // Redirect with error details
    const redirectUrl = `${frontendRedirectUri}?error=${encodeURIComponent(String(error))}&error_description=${encodeURIComponent(String(error_description || ''))}`;
    return res.redirect(redirectUrl);
  }

  if (!code) {
    // Missing code, redirect with error
    const redirectUrl = `${frontendRedirectUri}?error=missing_code`;
    return res.redirect(redirectUrl);
  }

  // Redirect with code and state
  const redirectUrl = `${frontendRedirectUri}?code=${encodeURIComponent(String(code))}${state ? `&state=${encodeURIComponent(String(state))}` : ''}`;
  return res.redirect(redirectUrl);
};