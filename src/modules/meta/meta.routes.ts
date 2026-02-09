// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as metaController from './meta.controller';

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