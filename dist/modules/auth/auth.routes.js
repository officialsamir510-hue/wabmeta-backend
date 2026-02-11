"use strict";
// src/modules/auth/auth.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const auth_schema_1 = require("./auth.schema");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================
/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 10 }), // 10 per hour
(0, validate_1.validate)(auth_schema_1.registerSchema), auth_controller_1.authController.register.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', rateLimit_1.authRateLimit, (0, validate_1.validate)(auth_schema_1.loginSchema), auth_controller_1.authController.login.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/google
 * @desc    Google OAuth login/register
 * @access  Public
 */
router.post('/google', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 20 }), (0, validate_1.validate)(auth_schema_1.googleAuthSchema), auth_controller_1.authController.googleAuth.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post('/verify-email', (0, validate_1.validate)(auth_schema_1.verifyEmailSchema), auth_controller_1.authController.verifyEmail.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post('/resend-verification', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 5 }), (0, validate_1.validate)(auth_schema_1.resendVerificationSchema), auth_controller_1.authController.resendVerification.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 5 }), (0, validate_1.validate)(auth_schema_1.forgotPasswordSchema), auth_controller_1.authController.forgotPassword.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', (0, validate_1.validate)(auth_schema_1.resetPasswordSchema), auth_controller_1.authController.resetPassword.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP to email
 * @access  Public
 */
router.post('/send-otp', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 3 }), // 3 per minute
(0, validate_1.validate)(auth_schema_1.resendOTPSchema), auth_controller_1.authController.sendOTP.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP
 * @access  Public
 */
router.post('/verify-otp', rateLimit_1.authRateLimit, (0, validate_1.validate)(auth_schema_1.verifyOTPSchema), auth_controller_1.authController.verifyOTP.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post('/refresh', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 10 }), auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post('/logout', auth_controller_1.authController.logout.bind(auth_controller_1.authController));
// ============================================
// PROTECTED ROUTES (Auth Required)
// ============================================
/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth_1.authenticate, auth_controller_1.authController.me.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', auth_1.authenticate, auth_controller_1.authController.logoutAll.bind(auth_controller_1.authController));
/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password', auth_1.authenticate, (0, validate_1.validate)(auth_schema_1.changePasswordSchema), auth_controller_1.authController.changePassword.bind(auth_controller_1.authController));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map