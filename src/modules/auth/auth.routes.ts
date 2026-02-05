// src/modules/auth/auth.routes.ts

import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authRateLimit, rateLimit } from '../../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyOTPSchema,
  resendOTPSchema,
  refreshTokenSchema,
  googleAuthSchema,
  changePasswordSchema,
  resendVerificationSchema,
} from './auth.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), // 10 per hour
  validate(registerSchema),
  authController.register.bind(authController)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  authController.login.bind(authController)
);

/**
 * @route   POST /api/v1/auth/google
 * @desc    Google OAuth login/register
 * @access  Public
 */
router.post(
  '/google',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }),
  validate(googleAuthSchema),
  authController.googleAuth.bind(authController)
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post(
  '/resend-verification',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
  validate(resendVerificationSchema),
  authController.resendVerification.bind(authController)
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP to email
 * @access  Public
 */
router.post(
  '/send-otp',
  rateLimit({ windowMs: 60 * 1000, max: 3 }), // 3 per minute
  validate(resendOTPSchema),
  authController.sendOTP.bind(authController)
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP
 * @access  Public
 */
router.post(
  '/verify-otp',
  authRateLimit,
  validate(verifyOTPSchema),
  authController.verifyOTP.bind(authController)
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post(
  '/refresh',
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authController.refreshToken.bind(authController)
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post('/logout', authController.logout.bind(authController));

// ============================================
// PROTECTED ROUTES (Auth Required)
// ============================================

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, authController.me.bind(authController));

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll.bind(authController)
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

export default router;