// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as metaController from './meta.controller';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   GET /api/v1/meta/callback
 * @desc    Handle OAuth callback from Meta
 * @access  Public (redirected from Meta)
 */
router.get('/callback', metaController.handleCallback);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/v1/meta/auth/url
 * @desc    Generate Meta OAuth URL for Embedded Signup
 * @access  Private
 */
router.get('/auth/url', authenticate, metaController.getAuthUrl);

// All remaining routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/meta/connect
 * @desc    Connect Meta account via authorization code
 * @access  Private
 */
router.post('/connect', metaController.connectMeta);

/**
 * @route   GET /api/v1/meta/status
 * @desc    Get Meta connection status
 * @access  Private
 */
router.get('/status', metaController.getConnectionStatus);

/**
 * @route   POST /api/v1/meta/refresh
 * @desc    Refresh Meta connection data
 * @access  Private
 */
router.post('/refresh', metaController.refreshConnection);

/**
 * @route   POST /api/v1/meta/disconnect
 * @desc    Disconnect Meta account
 * @access  Private
 */
router.post('/disconnect', metaController.disconnect);

/**
 * @route   GET /api/v1/meta/phone-numbers
 * @desc    Get connected phone numbers
 * @access  Private
 */
router.get('/phone-numbers', metaController.getPhoneNumbers);

/**
 * @route   POST /api/v1/meta/phone-numbers/:phoneNumberId/register
 * @desc    Register a phone number for messaging
 * @access  Private
 */
router.post('/phone-numbers/:phoneNumberId/register', metaController.registerPhoneNumber);

/**
 * @route   POST /api/v1/meta/test-message
 * @desc    Send a test message
 * @access  Private
 */
router.post('/test-message', metaController.sendTestMessage);

export default router;